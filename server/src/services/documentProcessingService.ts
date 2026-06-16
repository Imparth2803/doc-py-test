import fs from "fs";
import { classifyDocument } from "./classification/vaultClassifier";
import sharp from "sharp";
import {
  extractTextAndEvaluate
} from "./ocrService";

import Document, { IDocument } from "../models/Document";
import ProcessingJob, { IProcessingJob } from "../models/ProcessingJob";
import { analyzeDocumentWithGemini, analyzeTextWithGemini } from "./ai/geminiService";
import { mapDocumentUpdate } from "./documentMapper";
import { logMetric, logError, measureStep } from "../utils/logger";
import { extractTables } from "./tableExtractionService";

const PDF_TEXT_THRESHOLD = parseInt(process.env.PDF_TEXT_THRESHOLD || "100", 10);

// Protection Thresholds
const MAX_PDF_PAGES = parseInt(process.env.MAX_PDF_PAGES || "100", 10);
const LARGE_PDF_PAGES = parseInt(process.env.LARGE_PDF_PAGES || "25", 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "20", 10);
const LARGE_FILE_SIZE_MB = parseInt(process.env.LARGE_FILE_SIZE_MB || "10", 10);

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const LARGE_FILE_SIZE_BYTES = LARGE_FILE_SIZE_MB * 1024 * 1024;

/**
 * Reusable helper to update heartbeat for both Document and ProcessingJob
 */
const updateProcessingHeartbeat = async (document: IDocument, job?: IProcessingJob | null) => {
  const now = new Date();
  document.lastHeartbeatAt = now;
  await document.save();
  
  if (job) {
    job.lastHeartbeatAt = now;
    await job.save();
  }
};

export const processDocumentWithAI = async (documentId: string) => {
  const totalPerfStart = Date.now();
  let currentStage = "INITIALIZATION";
  let geminiMode: "TEXT" | "VISION" = "VISION";
  let textLength = 0;
  let classification: "NORMAL_DOCUMENT" | "LARGE_DOCUMENT" | "OVERSIZED_DOCUMENT" = "NORMAL_DOCUMENT";
  let extractedTables: any[] = [];
  
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  // Find associated processing job
  const job = await ProcessingJob.findOne({ documentId: document._id });
  const jobId = job?._id?.toString();

  try {
    // Update statuses to PROCESSING
    currentStage = "STATUS_UPDATE_START";
    document.status = "PROCESSING";
    document.processingStartedAt = new Date();
    await updateProcessingHeartbeat(document, job);

    // STEP 1 — Add EXIF Normalization
    if (document.mimeType.startsWith("image/")) {
      currentStage = "EXIF_NORMALIZATION";
      await updateProcessingHeartbeat(document, job); // Before EXIF
      
      await measureStep(documentId, "EXIF_NORMALIZATION", async () => {
        const originalPath = document.storagePath;
        const tempPath = `${originalPath}.exif.tmp.jpg`;

        try {
          await sharp(originalPath)
            .rotate()
            .withMetadata({ orientation: 1 })
            .toFile(tempPath);

          fs.renameSync(tempPath, originalPath);
        } catch (err: any) {
          logError({
            documentId,
            jobId,
            stage: "EXIF_NORMALIZATION_INTERNAL",
            message: err.message,
            stack: err.stack
          });
          // Non-fatal, continue
        }
      });
      
      await updateProcessingHeartbeat(document, job); // After EXIF
    }

    // STEP 2 — OCR / Text Extraction
    currentStage = "OCR_EXTRACTION";
    await updateProcessingHeartbeat(document, job); // Before OCR
    
    const ocrResult = await measureStep(documentId, "OCR_EXTRACTION", async () => {
      return await extractTextAndEvaluate(
        document.storagePath,
        document.mimeType
      );
    });
    
    await updateProcessingHeartbeat(document, job); // After OCR
    textLength = ocrResult.extractedText?.length || 0;

    // STEP 2.5 — Large PDF Protection Layer
    currentStage = "PROTECTION_LAYER";
    const fileStats = fs.statSync(document.storagePath);
    const fileSize = fileStats.size;
    const pageCount = ocrResult.pageCount || 1;

    if (pageCount > MAX_PDF_PAGES || fileSize > MAX_FILE_SIZE_BYTES) {
      classification = "OVERSIZED_DOCUMENT";
    } else if (pageCount > LARGE_PDF_PAGES || fileSize > LARGE_FILE_SIZE_BYTES) {
      classification = "LARGE_DOCUMENT";
    }

    // Structured logging for observability
    console.log(`[PROTECTION] Classification: ${classification} (Pages: ${pageCount}, Size: ${Math.round(fileSize / 1024 / 1024)}MB)`);
    
    logMetric({
      documentId,
      stepName: "DOCUMENT_CLASSIFICATION",
      durationMs: 0,
      metadata: {
        classification,
        pageCount,
        fileSizeBytes: fileSize,
        largeDocument: classification !== "NORMAL_DOCUMENT"
      }
    });

    if (classification === "OVERSIZED_DOCUMENT") {
      const errorMsg = `Document exceeds limits (Pages: ${pageCount}/${MAX_PDF_PAGES}, Size: ${Math.round(fileSize / 1024 / 1024)}MB/${MAX_FILE_SIZE_MB}MB)`;
      throw new Error(errorMsg);
    }

    if (classification === "LARGE_DOCUMENT") {
      console.warn(`[PROTECTION_WARNING] Processing large document: ${documentId} (${pageCount} pages, ${Math.round(fileSize / 1024 / 1024)}MB)`);
    }

    // STEP 2.7 — Table Extraction
    let extractedTables: any[] = [];
    const canExtractTables = 
      ocrResult.strategy === "DIGITAL_DOCUMENT" || 
      ocrResult.strategy === "SCANNED_DOCUMENT";

    if (canExtractTables) {
      currentStage = "TABLE_EXTRACTION";
      extractedTables = await extractTables(documentId, document.storagePath, ocrResult.strategy);
      
      // Update document immediately with table metadata (non-blocking for rest of flow)
      if (extractedTables.length > 0) {
        document.tables = extractedTables;
        // Wrap in safe try-catch as per Sprint 1 Audit recommendation
        try {
          await document.save();
        } catch (saveErr) {
          console.error("[TABLE_METADATA_SAVE_ERROR]", saveErr);
        }
      }
    }

    // STEP 3 — Gemini Analysis (Routing Decision)
    currentStage = "GEMINI_ANALYSIS";
    await updateProcessingHeartbeat(document, job); // Before Gemini
    
    const isDigitalPdf = document.mimeType === "application/pdf" && ocrResult.strategy === "DIGITAL_DOCUMENT";
    const hasEnoughText = textLength > PDF_TEXT_THRESHOLD;

    let aiResult: any;
    let aiSuccess = false;
    let aiErrorMsg = "";

    try {
      if (isDigitalPdf && hasEnoughText) {
        geminiMode = "TEXT";
        console.log(`[ROUTING] TEXT_MODE (length=${textLength})`);
        
        aiResult = await measureStep(documentId, "GEMINI_ANALYSIS_TEXT", async () => {
          return await analyzeTextWithGemini(
            ocrResult.extractedText,
            document.originalName
          );
        });
      } else {
        geminiMode = "VISION";
        const reason = !isDigitalPdf ? "NOT_A_PDF" : "LOW_TEXT_CONFIDENCE";
        console.log(`[ROUTING] VISION_MODE (reason=${reason}, length=${textLength})`);

        const fileBuffer = fs.readFileSync(document.storagePath);
        const base64Data = fileBuffer.toString("base64");
        
        aiResult = await measureStep(documentId, "GEMINI_ANALYSIS_VISION", async () => {
          return await analyzeDocumentWithGemini(
            base64Data,
            document.mimeType,
            document.originalName
          );
        });
      }
      aiSuccess = true;
    } catch (err: any) {
      console.error("[GEMINI_FAILED_SWALLOWED]", err.message);
      aiErrorMsg = err.message;
      // Initialize a fallback result for the mapper
      aiResult = {
        summary: "AI analysis unavailable (Service error)",
        category: "Other",
        tags: ["OCR_ONLY"],
        entities: [],
        suggestedFilename: document.originalName.split('.')[0],
        rotation: 0,
        summaryFields: {}
      };
    }
    
    await updateProcessingHeartbeat(document, job); // After Gemini

    // STEP 4 — Auto-rotation (Gemini driven - VISION ONLY)
    if (aiSuccess && document.mimeType.startsWith("image/") && geminiMode === "VISION") {
      currentStage = "GEMINI_ROTATION";
      const rotation = aiResult.rotation || 0;
      if (rotation !== 0) {
        await measureStep(documentId, "GEMINI_ROTATION", async () => {
          try {
            const originalPath = document.storagePath;
            const tempPath = `${originalPath}.tmp.jpg`;

            await sharp(originalPath)
              .rotate(-rotation)
              .withMetadata({ orientation: 1 })
              .toFile(tempPath);

            fs.renameSync(tempPath, originalPath);
          } catch (err: any) {
            logError({
              documentId,
              jobId,
              stage: "GEMINI_ROTATION_INTERNAL",
              message: err.message,
              stack: err.stack
            });
          }
        });
      }
    }

    // STEP 5 — Classification & Mapping
    currentStage = "CLASSIFICATION_AND_MAPPING";
    const vaultInfo = classifyDocument(aiResult.category);
    const update = mapDocumentUpdate(
      ocrResult,
      aiResult,
      vaultInfo,
      document.originalName
    );

    // STEP 6 — Persistence
    currentStage = "PERSISTENCE";
    await updateProcessingHeartbeat(document, job); // Before Save
    
    await measureStep(documentId, "DATABASE_SAVE", async () => {
      Object.assign(document, update);
      
      // Handle Partial Success
      if (!aiSuccess) {
        document.status = "PARTIAL_SUCCESS";
        document.metadata = {
          ...document.metadata,
          aiStatus: "FAILED",
          aiError: aiErrorMsg,
          ocrStatus: "SUCCESS"
        };
      } else {
        document.status = "COMPLETED";
      }

      document.processingCompletedAt = new Date();
      await document.save();

      if (job) {
        job.status = aiSuccess ? "COMPLETED" : "PARTIAL_SUCCESS";
        if (!aiSuccess) {
          job.errorMessage = `AI Analysis failed: ${aiErrorMsg}`;
        }
        job.completedAt = new Date();
        await job.save();
      }
    });
    
    await updateProcessingHeartbeat(document, job); // After Save

    const totalDurationMs = Date.now() - totalPerfStart;
    
    // FINAL BENCHMARK LOG
    logMetric({
      documentId,
      stepName: "TOTAL_PROCESSING",
      durationMs: totalDurationMs,
      metadata: {
        mimeType: document.mimeType,
        pageCount: ocrResult.pageCount,
        geminiMode,
        textLength,
        classification,
        largeDocument: classification !== "NORMAL_DOCUMENT",
        tablesFound: extractedTables.length,
        success: true
      }
    });

    return document;
  } catch (error: any) {
    const totalDurationMs = Date.now() - totalPerfStart;
    logError({
      documentId,
      jobId,
      stage: currentStage,
      message: error.message,
      stack: error.stack,
      metadata: {
        durationMs: totalDurationMs,
        geminiMode
      }
    });

    document.status = "FAILED";
    document.processingFailedAt = new Date();
    await document.save();

    if (job) {
      job.status = "FAILED";
      job.failedAt = new Date();
      job.errorMessage = `[${currentStage}] ${error.message}`;
      job.errorLogs.push(`${new Date().toISOString()} - ${currentStage}: ${error.message}`);
      await job.save();
    }

    throw error;
  }
};
