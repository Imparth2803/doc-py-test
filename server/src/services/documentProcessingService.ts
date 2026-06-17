import fs from "fs";
import { classifyDocument } from "./classification/vaultClassifier";
import sharp from "sharp";
import {
  extractTextAndEvaluate
} from "./ocrService";

import Document, { IDocument } from "../models/Document";
import ProcessingJob, { IProcessingJob } from "../models/ProcessingJob";
import { aiOrchestrator } from "./ai/aiOrchestrator";
import { extractMetadata } from "./metadata/metadataExtractor";
import { extractEntitiesWithGLiNER } from "./entities/glinerService";
import { mapGLiNEREntitiesToFlatArray } from "./entities/entityMapper";
import { compareEntities } from "./entities/entityComparator";
import { classifyDocumentByRules } from "./classification/ruleClassifier";
import { compareClassifications, printClassificationBenchmark } from "./classification/classificationComparator";
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
    if (document.status !== "PROCESSING") {
      document.status = "PROCESSING";
      document.processingStartedAt = new Date();
    }
    
    // Initialize checkpoint if missing
    if (!document.processingCheckpoint) {
      document.processingCheckpoint = {
        ocrCompleted: false,
        enrichmentCompleted: false,
        aiCompleted: false
      };
    }
    
    await updateProcessingHeartbeat(document, job);

    console.log('\n====================================');
    console.log('Checkpoint Status');
    console.log('====================================');
    console.log(`OCR: ${document.processingCheckpoint.ocrCompleted}`);
    console.log(`Enrichment: ${document.processingCheckpoint.enrichmentCompleted}`);
    console.log(`AI: ${document.processingCheckpoint.aiCompleted}`);
    console.log('====================================\n');

    // STEP 1 — Add EXIF Normalization
    if (!document.processingCheckpoint.ocrCompleted && document.mimeType.startsWith("image/")) {
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
    let ocrResult: any;
    
    if (document.processingCheckpoint.ocrCompleted) {
      console.log('[CHECKPOINT] OCR already completed. Skipping.');
      ocrResult = {
        extractedText: document.extractedText || "",
        confidence: document.ocrConfidence || 0,
        strategy: document.processingStrategy || "PENDING",
        pageCount: 1 // Safe fallback if unknown
      };
    } else {
      await updateProcessingHeartbeat(document, job); // Before OCR
      
      ocrResult = await measureStep(documentId, "OCR_EXTRACTION", async () => {
        return await extractTextAndEvaluate(
          document.storagePath,
          document.mimeType
        );
      });
      
      // CHECKPOINT #1 - OCR Persistence
      document.extractedText = ocrResult.extractedText;
      document.ocrConfidence = ocrResult.confidence;
      document.processingStrategy = ocrResult.strategy;
      document.processingCheckpoint.ocrCompleted = true;
      await document.save();
    }
    
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

    if (!document.processingCheckpoint.enrichmentCompleted) {
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
    }

    if (classification === "OVERSIZED_DOCUMENT") {
      const errorMsg = `Document exceeds limits (Pages: ${pageCount}/${MAX_PDF_PAGES}, Size: ${Math.round(fileSize / 1024 / 1024)}MB/${MAX_FILE_SIZE_MB}MB)`;
      throw new Error(errorMsg);
    }

    if (classification === "LARGE_DOCUMENT") {
      console.warn(`[PROTECTION_WARNING] Processing large document: ${documentId} (${pageCount} pages, ${Math.round(fileSize / 1024 / 1024)}MB)`);
    }

    // ENRICHMENT PHASE
    let regexMetadata: any;
    let flatGlinerEntities: string[] = [];
    let glinerResult: any;
    let ruleClassification: any;

    if (document.processingCheckpoint.enrichmentCompleted) {
      console.log('[CHECKPOINT] Enrichment already completed. Skipping.');
      regexMetadata = document.metadata || {};
      flatGlinerEntities = document.entities || [];
      // We don't have ruleClassification preserved easily, but it's diagnostics only.
    } else {
      // STEP 2.2 — Regex Metadata Extraction
      currentStage = "METADATA_EXTRACTION";
      regexMetadata = extractMetadata(ocrResult.extractedText || "");

      // STEP 2.6 — GLiNER Entity Extraction (Shadow Mode)
      currentStage = "GLINER_EXTRACTION";
      glinerResult = await extractEntitiesWithGLiNER(ocrResult.extractedText || "");
      flatGlinerEntities = mapGLiNEREntitiesToFlatArray(glinerResult.entities);

      // STEP 2.65 - Rule-Based Document Classification (Shadow Mode)
      currentStage = "RULE_CLASSIFICATION";
      ruleClassification = classifyDocumentByRules(ocrResult.extractedText || "", regexMetadata);

      // CHECKPOINT #2 - Enrichment Persistence
      document.metadata = regexMetadata;
      document.entities = flatGlinerEntities;
      document.processingCheckpoint.enrichmentCompleted = true;
      await document.save();
    }

    // STEP 2.7 — Table Extraction
    // Note: Table extraction writes files to disk. To be fully retry-safe, 
    // it should either be skipped if tables already exist, or clear the folder first.
    // For now, we only run it if enrichment wasn't skipped (or if we track it).
    // Let's rely on the AI completion status, since table extraction happens right before AI.
    // Actually, to prevent duplicates, we can check if document.tables has elements.
    const canExtractTables = 
      ocrResult.strategy === "DIGITAL_DOCUMENT" || 
      ocrResult.strategy === "SCANNED_DOCUMENT";

    if (canExtractTables && (!document.tables || document.tables.length === 0)) {
      currentStage = "TABLE_EXTRACTION";
      extractedTables = await extractTables(documentId, document.storagePath, ocrResult.strategy);
      
      if (extractedTables.length > 0) {
        document.tables = extractedTables;
        try {
          await document.save();
        } catch (saveErr) {
          console.error("[TABLE_METADATA_SAVE_ERROR]", saveErr);
        }
      }
    } else if (document.tables && document.tables.length > 0) {
      console.log('[CHECKPOINT] Tables already extracted. Skipping.');
      extractedTables = document.tables;
    }

    // STEP 3 — Gemini Analysis (Routing Decision)
    currentStage = "GEMINI_ANALYSIS";
    await updateProcessingHeartbeat(document, job); // Before Gemini
    
    let aiResult: any;
    let aiSuccess = false;
    let aiErrorMsg = "";

    if (document.processingCheckpoint.aiCompleted) {
      console.log('[CHECKPOINT] AI already completed. Skipping.');
      aiSuccess = true;
      // We don't reconstruct aiResult fully because it's already in the DB.
      // But we need it for mapping. Actually, if it's aiCompleted, we can just jump to COMPLETED.
      // Wait, if AI completed, it means the document should already be mapped and finished.
      // If we crashed between Checkpoint #3 and final status update, we need to finalize.
    } else {
      const isDigitalPdf = document.mimeType === "application/pdf" && ocrResult.strategy === "DIGITAL_DOCUMENT";
      const hasEnoughText = textLength > PDF_TEXT_THRESHOLD;

      try {
        if (isDigitalPdf && hasEnoughText) {
          geminiMode = "TEXT";
          console.log(`[ROUTING] TEXT_MODE (length=${textLength})`);
          
          aiResult = await measureStep(documentId, "GEMINI_ANALYSIS_TEXT", async () => {
            return await aiOrchestrator.analyzeText(
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
            return await aiOrchestrator.analyzeDocument(
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
      
      // Merge Regex Metadata with AI Metadata
      const mergedMetadata = {
        ...regexMetadata,
        ...(aiResult.metadata || {})
      };
      aiResult.metadata = mergedMetadata;
      
      if (glinerResult && ruleClassification) {
        // Entity Comparison (Shadow Mode)
        const entityComparison = compareEntities(aiResult.entities || [], flatGlinerEntities);
        
        const benchmarkDiagnostics = {
          entityComparison,
          glinerLatencyMs: glinerResult.latencyMs,
          glinerEntityCount: flatGlinerEntities.length,
          ocrTextLength: textLength,
          documentType: aiResult.category || 'UNKNOWN',
          chunkCount: glinerResult.chunkCount,
          avgConfidence: glinerResult.avgConfidence
        };

        console.log('\n==================================');
        console.log('GLiNER Benchmark');
        console.log('==================================');
        console.log(`Document Type: ${benchmarkDiagnostics.documentType}\n`);
        console.log(`OCR Text Length: ${benchmarkDiagnostics.ocrTextLength}\n`);
        console.log(`Chunk Count: ${benchmarkDiagnostics.chunkCount}\n`);
        console.log(`GLiNER Entities: ${benchmarkDiagnostics.glinerEntityCount}\n`);
        console.log(`Average Confidence: ${benchmarkDiagnostics.avgConfidence.toFixed(2)}\n`);
        console.log(`Latency: ${benchmarkDiagnostics.glinerLatencyMs}ms\n`);
        console.log(`Exact Overlap: ${entityComparison.exactOverlapCount}\n`);
        console.log(`Fuzzy Overlap: ${entityComparison.fuzzyOverlapCount}\n`);
        console.log(`Gemini Only: ${entityComparison.geminiOnlyCount}\n`);
        console.log(`GLiNER Only: ${entityComparison.glinerOnlyCount}`);
        console.log('==================================\n');

        // Classification Comparison (Shadow Mode)
        const classificationComparison = compareClassifications(ruleClassification, aiResult.category || "UNKNOWN");
        printClassificationBenchmark(classificationComparison);

        aiResult.metadata.processingDiagnostics = {
          ...aiResult.metadata.processingDiagnostics,
          ...benchmarkDiagnostics,
          ruleClassification: {
            category: ruleClassification.category,
            confidence: ruleClassification.confidence
          },
          classificationComparison: {
            match: classificationComparison.match
          }
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

      // CHECKPOINT #3 - AI Persistence
      Object.assign(document, update);
      if (!aiSuccess) {
        document.metadata = {
          ...document.metadata,
          aiStatus: "FAILED",
          aiError: aiErrorMsg,
          ocrStatus: "SUCCESS"
        };
      }
      document.processingCheckpoint.aiCompleted = true;
      await document.save();
    }

    // STEP 6 — Final Status Update
    currentStage = "PERSISTENCE";
    await updateProcessingHeartbeat(document, job); // Before Save
    
    await measureStep(documentId, "DATABASE_SAVE", async () => {
      // Handle Partial Success
      if (!aiSuccess && !document.processingCheckpoint?.aiCompleted) {
        // Fallback catch, though aiCompleted handles saving the failure state
        document.status = "PARTIAL_SUCCESS";
      } else if (!aiSuccess && document.processingCheckpoint?.aiCompleted && document.metadata?.aiStatus === "FAILED") {
        document.status = "PARTIAL_SUCCESS";
      } else {
        document.status = "COMPLETED";
      }

      document.processingCompletedAt = new Date();
      await document.save();

      if (job) {
        job.status = document.status === "COMPLETED" ? "COMPLETED" : "PARTIAL_SUCCESS";
        if (document.status === "PARTIAL_SUCCESS") {
          job.errorMessage = `AI Analysis failed or was skipped.`;
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
        pageCount: document.tables?.length ? Math.max(...document.tables.map(t => t.pageNumber)) : 1,
        geminiMode,
        textLength,
        classification,
        largeDocument: classification !== "NORMAL_DOCUMENT",
        tablesFound: document.tables?.length || 0,
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
