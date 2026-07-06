import { Request, Response } from 'express';
import { processDocumentWithAI } from '../services/documentProcessingService';
import Document from '../models/Document';
import ProcessingJob from '../models/ProcessingJob';
import mongoose from 'mongoose';
import fs from 'fs';
import sharp from 'sharp';
import { addDocumentJob, isQueueEnabled } from '../queue/documentQueue';
import { getQueueEvents } from '../queue/queueEvents';
import { checkAndDecryptPDF } from '../utils/pdfDecryptor';
import { emitDocumentStatus } from '../services/socket';

// ... other imports ...

/**
 * Upload Document
 */
export const uploadDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log('\n==============================');
  console.log('UPLOAD REQUEST STARTED');
  console.log('==============================');

  try {
    // STEP 1
    console.log('\n[STEP 1] Request received');

    // STEP 2
    console.log('\n[STEP 2] Checking req.file');

    console.log('REQ.FILE EXISTS:', !!req.file);

    console.log('REQ.FILE VALUE:', req.file);

    if (!req.file) {
      console.log('\n❌ NO FILE FOUND');

      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });

      return;
    }

    // Intercept PDF upload to check for encryption
    if (req.file.mimetype === 'application/pdf') {
      let parsedProfile = {};
      if (req.body?.userProfile) {
        try {
          parsedProfile = typeof req.body.userProfile === 'string'
            ? JSON.parse(req.body.userProfile)
            : req.body.userProfile;
        } catch (e) {
          console.error("Failed to parse userProfile:", e);
        }
      }

      const result = await checkAndDecryptPDF(req.file.path, parsedProfile);
      if (result.isEncrypted) {
        if (result.decrypted) {
          console.log(`[DECRYPT] Auto-unlock succeeded for ${req.file.originalname}`);
        } else {
          console.log(`[DECRYPT] Auto-unlock failed for ${req.file.originalname}. NEEDS_PASSWORD status applied.`);
          
          const document = await Document.create({
            originalName: req.file.originalname,
            storagePath: req.file.path,
            mimeType: req.file.mimetype,
            status: 'NEEDS_PASSWORD',
          });

          emitDocumentStatus(document._id.toString(), 'NEEDS_PASSWORD');

          const job = await ProcessingJob.create({
            documentId: document._id,
            status: 'PENDING',
            errorMessage: 'Password protected PDF. Decryption required.',
          });

          res.status(200).json({
            success: true,
            message: 'Password required',
            document,
            job,
          });

          return;
        }
      }
    }

    // STEP 3
    console.log('\n[STEP 3] File details');

    console.log('Original Name:', req.file.originalname);
    console.log('Mime Type:', req.file.mimetype);
    console.log('Storage Path:', req.file.path);

    // STEP 4
    console.log('\n[STEP 4] Creating Mongo document');

    const document = await Document.create({
      originalName: req.file.originalname,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
    });

    console.log('\n✅ DOCUMENT CREATED');

    const fileStats = fs.statSync(req.file.path);
    const path = require('path');
    console.log('\n[UPLOAD]');
    console.log('Document ID:', document._id.toString());
    console.log('Original Name:', req.file.originalname);
    console.log('Stored Filename:', path.basename(req.file.path));
    console.log('Storage Path:', req.file.path);
    console.log('MIME Type:', req.file.mimetype);
    console.log('File Size (bytes):', fileStats.size);
    console.log('Last Modified Time:', fileStats.mtime);
    console.log('----------------------------------------\n');

    console.log('DOCUMENT:', document);

    // STEP 5
    console.log('\n[STEP 5] Creating processing job');

    const job = await ProcessingJob.create({
      documentId: document._id,
      status: 'PENDING',
    });

    console.log('\n✅ JOB CREATED');

    console.log('JOB:', job);

    // STEP 6
    console.log('\n[STEP 6] Sending success response');

    res.status(201).json({
      success: true,
      message: 'Upload successful',
      document,
      job,
    });

    console.log('\n✅ RESPONSE SENT');

  } catch (error: any) {
    console.log('\n==============================');
    console.log('❌ UPLOAD FAILED');
    console.log('==============================');

    console.log('\nERROR MESSAGE:');
    console.log(error?.message);

    console.log('\nFULL ERROR OBJECT:');
    console.log(error);

    console.log('\nSTACK TRACE:');
    console.log(error?.stack);

    res.status(500).json({
      success: false,
      message: error?.message || 'Upload failed',
    });
  }

  console.log('\n==============================');
  console.log('UPLOAD REQUEST ENDED');
  console.log('==============================\n');
};

/**
 * Get All Documents
 */
export const getDocuments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('===== GET DOCUMENTS =====');
    console.log(
      'Ready State:',
      mongoose.connection.readyState
    );
    console.log(
      'Host:',
      mongoose.connection.host
    );
    console.log(
      'Database:',
      mongoose.connection.name
    );
    console.log(
      'Models:',
      mongoose.modelNames()
    );

    const documents = await Document.find().sort({
      createdAt: -1,
    });

    console.log('DOCUMENT COUNT:', documents.length);

    const fileSys = require('fs');
    const { buildPreviewUrl } = require('../utils/storagePathUtils');
    console.log('\n--- [DATABASE MULTI-FETCH] ---');
    documents.slice(0, 3).forEach(doc => {
      const pUrl = buildPreviewUrl(doc.storagePath, undefined, doc);
      console.log(`[DATABASE]`);
      console.log('Document ID:', doc._id.toString());
      console.log('storagePath:', doc.storagePath);
      console.log('originalName:', doc.originalName);
      console.log('documentName:', doc.documentName || 'N/A');
      console.log('previewUrl:', pUrl);
      console.log('storagePath exists:', fileSys.existsSync(doc.storagePath));
      console.log('----------------------------------------');
    });

    res.status(200).json({
      success: true,
      documents,
    });

  } catch (error: any) {
    console.log('\n❌ GET DOCUMENTS ERROR');

    console.log(error);

    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch documents',
    });
  }
};

/**
 * Get Single Document
 */
export const getDocumentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('\nGET DOCUMENT BY ID ROUTE HIT');

    const { id } = req.params;

    console.log('DOCUMENT ID:', id);

    const document = await Document.findById(id);

    if (!document) {
      console.log('\n❌ DOCUMENT NOT FOUND');

      res.status(404).json({
        success: false,
        message: 'Document not found',
      });

      return;
    }

    console.log('\n✅ DOCUMENT FOUND');

    const fileSys = require('fs');
    const { buildPreviewUrl } = require('../utils/storagePathUtils');
    const pUrl = buildPreviewUrl(document.storagePath, undefined, document);
    console.log('\n[DATABASE]');
    console.log('Document ID:', document._id.toString());
    console.log('storagePath:', document.storagePath);
    console.log('originalName:', document.originalName);
    console.log('documentName:', document.documentName || 'N/A');
    console.log('previewUrl:', pUrl);
    console.log('storagePath exists:', fileSys.existsSync(document.storagePath));
    console.log('----------------------------------------\n');

    res.status(200).json({
      success: true,
      document,
    });

  } catch (error: any) {
    console.log('\n❌ GET DOCUMENT ERROR');

    console.log(error);

    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch document',
    });
  }
};

/**
 * Get Processing Job Status
 */
export const getJobStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log('\nGET JOB STATUS ROUTE HIT');

    const { id } = req.params;

    console.log('DOCUMENT ID:', id);

    const job = await ProcessingJob.findOne({
      documentId: id,
    });

    if (!job) {
      console.log('\n❌ JOB NOT FOUND');

      res.status(404).json({
        success: false,
        message: 'Processing job not found',
      });

      return;
    }

    console.log('\n✅ JOB FOUND');

    res.status(200).json({
      success: true,
      job,
    });

  } catch (error: any) {
    console.log('\n❌ JOB STATUS ERROR');

    console.log(error);

    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch job status',
    });
  }
};

/**
 * Update Document
 */
export const updateDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('\nUPDATE DOCUMENT ROUTE HIT');
    console.log('DOCUMENT ID:', id);
    console.log('UPDATES:', updates);

    const document = await Document.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      document,
    });
  } catch (error: any) {
    console.log('\n❌ UPDATE DOCUMENT ERROR', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to update document',
    });
  }
};

export const processDocument = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const language = req.body?.language || req.query?.language || 'en';


    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Ensure document status is set to PROCESSING
    if (document.status !== 'PROCESSING') {
      document.status = 'PROCESSING';
      document.processingStartedAt = new Date();
      document.processingCompletedAt = undefined;
      document.processingFailedAt = undefined;
      await document.save();
      emitDocumentStatus(document._id.toString(), 'PROCESSING');
    }

    // Find or create associated processing job
    let jobDoc = await ProcessingJob.findOne({ documentId: document._id });
    if (!jobDoc) {
      jobDoc = await ProcessingJob.create({
        documentId: document._id,
        status: 'PENDING',
      });
    } else {
      jobDoc.status = 'PENDING';
      jobDoc.attempts = 0;
      jobDoc.startedAt = undefined;
      jobDoc.completedAt = undefined;
      jobDoc.failedAt = undefined;
      jobDoc.errorMessage = undefined;
      await jobDoc.save();
    }

    console.log(`[PROCESS] Enqueueing BullMQ Job for document ${id} with language ${language}`);
    const bullJob = await addDocumentJob(id, jobDoc._id.toString(), language);

    res.status(202).json({
      success: true,
      message: 'Processing started',
      document,
      job: jobDoc,
    });
  } catch (error: any) {
    console.error('[PROCESS_ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start document processing',
    });
  }
};

/**
 * Rotate Document
 */
export const rotateDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  let tempPath: string | null = null;
  try {
    const { id } = req.params;
    const { rotation } = req.body;

    console.log(`[MANUAL_ROTATE] Document: ${id}`);
    console.log(`[MANUAL_ROTATE] Rotation: ${rotation}`);

    // 3. Validate rotation
    if (![90, 180, 270].includes(rotation)) {
      res.status(400).json({
        success: false,
        message: 'Invalid rotation. Must be 90, 180, or 270.',
      });
      return;
    }

    // 4. Find document
    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
      });
      return;
    }

    // 5. Verify mimeType
    if (!document.mimeType?.startsWith('image/')) {
      res.status(400).json({
        success: false,
        message: 'Manual rotation only supported for images',
      });
      return;
    }

    // 6. Read storagePath
    const { getAbsoluteStoragePath } = require('../utils/storagePathUtils');
    const storagePath = getAbsoluteStoragePath(document.storagePath);

    // 7. Create temp file
    tempPath = `${storagePath}.tmp.jpg`;

    // 8. Use sharp to rotate
    await sharp(storagePath)
      .rotate(rotation)
      .withMetadata({
        orientation: 1,
      })
      .toFile(tempPath);

    // 9. Replace original
    fs.renameSync(tempPath, storagePath);

    console.log(`[MANUAL_ROTATE] Complete`);

    // 10. Return success
    res.status(200).json({
      success: true,
      rotation,
    });
  } catch (error: any) {
    console.error('[MANUAL_ROTATE] Error:', error);
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Manual rotation failed',
    });
  }
};

/**
 * Manually decrypts a password protected PDF
 */
export const decryptManualDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({
        success: false,
        error: "Decryption failed. A password is required.",
      });
      return;
    }

    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        error: "Document not found.",
      });
      return;
    }

    const { getAbsoluteStoragePath } = require('../utils/storagePathUtils');
    const absolutePath = getAbsoluteStoragePath(document.storagePath);

    // Call checkAndDecryptPDF passing the storagePath and manualPassword
    const result = await checkAndDecryptPDF(absolutePath, {}, password);

    if (!result.decrypted) {
      res.status(400).json({
        success: false,
        error: "Decryption failed. The password provided is incorrect.",
      });
      return;
    }

    // Reset checkpoints to trigger a clean run
    document.processingCheckpoint = {
      ocrCompleted: false,
      enrichmentCompleted: false,
      tablesCompleted: false,
      aiCompleted: false
    };

    // Clear OCR artifacts
    document.extractedText = '';
    document.ocrConfidence = undefined;
    document.ocrAngle = undefined;
    document.ocrOrientationConfidence = undefined;

    // Clear enrichment results
    document.entities = [];
    document.tables = [];

    // Clear AI outputs
    document.documentName = document.originalName;

    if (document.metadata) {
      if (document.metadata instanceof Map) {
        document.metadata.delete('summaryFields');
        document.metadata.delete('aiSummary');
        document.metadata.delete('aiCategory');
        document.metadata.delete('aiTags');
        document.metadata.delete('processingDiagnostics');
      } else {
        delete (document.metadata as any).summaryFields;
        delete (document.metadata as any).aiSummary;
        delete (document.metadata as any).aiCategory;
        delete (document.metadata as any).aiTags;
        delete (document.metadata as any).processingDiagnostics;
      }
    }

    // Reset processing state
    document.status = 'DECRYPTED';
    document.processingStartedAt = undefined;
    document.processingCompletedAt = undefined;
    document.processingFailedAt = undefined;

    await document.save();
    emitDocumentStatus(document._id.toString(), 'DECRYPTED');

    console.log(`[DECRYPT] Decrypted successfully. Status set to DECRYPTED for document ${id}. Awaiting manual trigger.`);

    res.status(200).json({
      success: true,
      message: "Decryption successful. Ready for manual analysis.",
      document,
    });
  } catch (error: any) {
    console.error("[DECRYPT_MANUAL_ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during decryption.",
    });
  }
};

/**
 * Toggle pinned summary fields for a document
 */
export const togglePinField = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { fieldKey } = req.body;

    if (!fieldKey) {
      res.status(400).json({
        success: false,
        message: 'fieldKey is required in req.body',
      });
      return;
    }

    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
      });
      return;
    }

    if (!document.pinnedFields) {
      document.pinnedFields = [];
    }

    const index = document.pinnedFields.indexOf(fieldKey);
    if (index > -1) {
      // Unpin the field
      document.pinnedFields.splice(index, 1);
    } else {
      // Pin the field, check limit of 3
      if (document.pinnedFields.length >= 3) {
        res.status(400).json({
          success: false,
          message: 'Maximum of 3 pinned fields allowed',
        });
        return;
      }
      document.pinnedFields.push(fieldKey);
    }

    await document.save();

    res.status(200).json({
      success: true,
      pinnedFields: document.pinnedFields,
    });
  } catch (error: any) {
    console.error('[TOGGLE_PIN_ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle pinned field',
    });
  }
};

/**
 * Send a document as an email attachment using SMTP config
 */
export const emailDocument = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { to } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      res.status(400).json({
        success: false,
        error: 'A valid recipient email address ("to") is required.',
      });
      return;
    }

    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
      return;
    }

    const { sendDocumentEmail } = require('../services/emailService');
    await sendDocumentEmail(to, document);

    res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error('[EMAIL_DOCUMENT_ERROR]', error);
    res.status(500).json({
      error: error.message || 'Failed to send document email.',
    });
  }
};

/**
 * Get Consolidated Tables Metadata for a document
 */
export const getDocumentTables = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
      return;
    }

    const { getNormalizedTablesInfo } = require('../services/tableStorageService');
    const info = getNormalizedTablesInfo(document);
    res.status(200).json(info);
  } catch (error: any) {
    console.error('[GET_DOCUMENT_TABLES_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve tables metadata.',
    });
  }
};

/**
 * Get parsed grid cells and sheet metadata for a worksheet
 */
export const getDocumentTableSheet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, sheet } = req.params;
    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
      return;
    }

    const path = require('path');
    const fs = require('fs');
    const XLSX = require('xlsx');
    const { getNormalizedTablesInfo, parseExcelSheet } = require('../services/tableStorageService');
    
    const info = getNormalizedTablesInfo(document);
    const sheetMeta = info.tables.find((t: any) => t.sheetName === sheet);

    const uploadsDir = path.resolve(__dirname, '../../uploads');
    let workbookAbsPath = '';
    let finalSheetName = sheet;

    if (Array.isArray(document.tables)) {
      // Legacy document compat layer
      const legacyTable = document.tables.find((t: any) => t.tableId === sheet);
      if (!legacyTable) {
        res.status(404).json({
          success: false,
          error: `Worksheet "${sheet}" not found in legacy tables.`,
        });
        return;
      }
      const { getAbsoluteStoragePath } = require('../utils/storagePathUtils');
      workbookAbsPath = getAbsoluteStoragePath(legacyTable.excelPath);
      
      if (!fs.existsSync(workbookAbsPath)) {
        res.status(404).json({
          success: false,
          error: `Excel file not found on disk: ${legacyTable.excelPath}`,
        });
        return;
      }
      
      const sheetWorkbook = XLSX.readFile(workbookAbsPath);
      finalSheetName = sheetWorkbook.SheetNames[0];
    } else {
      // New consolidated document format
      if (!document.tables || !document.tables.workbookPath) {
        res.status(404).json({
          success: false,
          error: 'Consolidated workbook path missing in database.',
        });
        return;
      }
      const cleanPath = document.tables.workbookPath.replace(/^\/uploads/, '');
      workbookAbsPath = path.join(uploadsDir, cleanPath);
    }

    const data = parseExcelSheet(workbookAbsPath, finalSheetName, document, sheetMeta);
    res.status(200).json({
      success: true,
      ...data,
      grid_items: sheetMeta?.grid_items || [],
      table_metadata: sheetMeta?.table_metadata || {},
      layoutConfidence: sheetMeta?.layoutConfidence !== undefined ? sheetMeta.layoutConfidence : 1.0,
      extractionConfidence: sheetMeta?.extractionConfidence !== undefined ? sheetMeta.extractionConfidence : 1.0,
      extractionEngine: sheetMeta?.extractionEngine || sheetMeta?.engine || 'camelot',
      layoutEvidence: sheetMeta?.layoutEvidence || { tableEvidence: 1.0, keyValueEvidence: 0.0, reasons: [] }
    });
  } catch (error: any) {
    console.error('[GET_DOCUMENT_TABLE_SHEET_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse worksheet.',
    });
  }
};

/**
 * Download Consolidated tables workbook (dynamically builds it for legacy documents)
 */
export const downloadDocumentTables = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const document = await Document.findById(id);
    if (!document) {
      res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
      return;
    }

    const path = require('path');
    const fs = require('fs');
    const { getOrGenerateLegacyWorkbook } = require('../services/tableStorageService');

    let workbookAbsPath = '';
    const nameWithoutExt = (document.documentName || document.originalName).replace(/\.[^/.]+$/, "");
    const downloadFilename = `${nameWithoutExt}_Tables.xlsx`;

    if (Array.isArray(document.tables)) {
      // Legacy document: consolidate loose files on the fly
      if (document.tables.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Document has no tables to download.',
        });
        return;
      }
      workbookAbsPath = await getOrGenerateLegacyWorkbook(document);
    } else {
      // New format: send workbook directly
      if (!document.tables || !document.tables.workbookPath) {
        res.status(404).json({
          success: false,
          error: 'Workbook not found.',
        });
        return;
      }
      const uploadsDir = path.resolve(__dirname, '../../uploads');
      const cleanPath = document.tables.workbookPath.replace(/^\/uploads/, '');
      workbookAbsPath = path.join(uploadsDir, cleanPath);
    }

    if (!fs.existsSync(workbookAbsPath)) {
      res.status(404).json({
        success: false,
        error: 'Workbook file not found on disk.',
      });
      return;
    }

    res.download(workbookAbsPath, downloadFilename);
  } catch (error: any) {
    console.error('[DOWNLOAD_DOCUMENT_TABLES_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download tables workbook.',
    });
  }
};