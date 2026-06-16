import { Request, Response } from 'express';
import { processDocumentWithAI } from '../services/documentProcessingService';
import Document from '../models/Document';
import ProcessingJob from '../models/ProcessingJob';
import mongoose from 'mongoose';
import fs from 'fs';
import sharp from 'sharp';
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

    const result = await processDocumentWithAI(id);

    res.json({
      success: true,
      document: result,
    });
  } catch (error: any) {
    console.error(error);

    if (error.name === 'AIQuotaExceededError' || error.errorCode === 'AI_QUOTA_EXCEEDED' || error.status === 429) {
      return res.status(429).json({
        success: false,
        errorCode: "AI_QUOTA_EXCEEDED",
        message: "AI processing quota exceeded. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Document processing failed',
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
    const storagePath = document.storagePath;

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