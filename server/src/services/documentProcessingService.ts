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
import { sanitizeOCRText } from "./ocr/ocrSanitizer";
import { printOCRQualityBenchmark } from "./ocr/ocrComparator";
import { analyzeDocumentLocally, LocalDocumentAnalysis } from "./analysis/localDocumentAnalyzer";
import { printAnalysisBenchmark } from "./analysis/analysisComparator";
import { emitDocumentStatus } from "./socket";
import { compareLocalVsGemini } from "./analysis/localVsGeminiComparator";
import { buildSummaryFields } from "./metadata/summaryFieldBuilder";
import { mapDocumentUpdate } from "./documentMapper";
import { getPlainMetadata } from "../utils/metadataUtils";
import { logMetric, logError, measureStep } from "../utils/logger";
import { extractTables } from "./tableExtractionService";
import { calculateAIUnitsForDocument } from "./aiUnitCalculator";

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

export const processDocumentWithAI = async (documentId: string, language: string = 'en') => {
  const totalPerfStart = Date.now();
  let currentStage = "INITIALIZATION";
  let geminiMode: "TEXT" | "VISION" = "VISION";
  let textLength = 0;
  let classification: "NORMAL_DOCUMENT" | "LARGE_DOCUMENT" | "OVERSIZED_DOCUMENT" = "NORMAL_DOCUMENT";
  let extractedTables: any = null;
  
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  // Ensure storagePath is absolute for local processing operations
  const { getAbsoluteStoragePath } = require('../utils/storagePathUtils');
  document.storagePath = getAbsoluteStoragePath(document.storagePath);

  // Find associated processing job
  const job = await ProcessingJob.findOne({ documentId: document._id });
  const jobId = job?._id?.toString();

  try {
    // Update statuses to PROCESSING
    currentStage = "STATUS_UPDATE_START";
    if (document.status !== "PROCESSING") {
      document.status = "PROCESSING";
      document.processingStartedAt = new Date();
      await document.save();
      emitDocumentStatus(documentId, 'PROCESSING');
    }
    
    // Initialize checkpoint if missing
    if (!document.processingCheckpoint) {
      document.processingCheckpoint = {
        ocrCompleted: false,
        enrichmentCompleted: false,
        tablesCompleted: false,
        aiCompleted: false
      };
    }
    
    const checkpoint = document.processingCheckpoint!;
    
    await updateProcessingHeartbeat(document, job);

    console.log('\n====================================');
    console.log('Checkpoint Status');
    console.log('====================================');
    console.log(`OCR: ${checkpoint.ocrCompleted}`);
    console.log(`Enrichment: ${checkpoint.enrichmentCompleted}`);
    console.log(`Tables: ${checkpoint.tablesCompleted}`);
    console.log(`AI: ${checkpoint.aiCompleted}`);
    console.log('====================================\n');

    // STEP 1 — Add EXIF Normalization
    if (!checkpoint.ocrCompleted && document.mimeType.startsWith("image/")) {
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
    
    if (checkpoint.ocrCompleted) {
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
          document.mimeType,
          language
        );
      });
      
      // Phase 4.3 - OCR Sanitization Layer
      const { cleanedText, diagnostics: ocrDiagnostics } = sanitizeOCRText(ocrResult.extractedText);
      ocrResult.extractedText = cleanedText; // Update downstream consumers to use cleaned text
      printOCRQualityBenchmark(ocrDiagnostics);

      // CHECKPOINT #1 - OCR Persistence
      document.extractedText = cleanedText; // Save ONLY the cleaned text
      document.ocrConfidence = ocrResult.confidence;
      document.processingStrategy = ocrResult.strategy;
      document.ocrAngle = ocrResult.angle ?? 0;
      document.ocrOrientationConfidence = ocrResult.orientationConfidence ?? 0;
      
      // Store OCR diagnostics immediately
      const plainOcrExisting = getPlainMetadata(document.metadata);
      document.metadata = {
        ...plainOcrExisting,
        processingDiagnostics: {
          ...(plainOcrExisting.processingDiagnostics || {}),
          ocrQuality: ocrDiagnostics,
          pdfExtraction: ocrResult.pdfExtraction
        }
      };

      checkpoint.ocrCompleted = true;


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

    if (checkpoint.enrichmentCompleted) {
      console.log('[CHECKPOINT] Enrichment already completed. Skipping.');
      regexMetadata = getPlainMetadata(document.metadata);
      flatGlinerEntities = document.entities || [];
      // We don't have ruleClassification preserved easily, but it's diagnostics only.
    } else {
      // STEP 2.2 — Regex Metadata Extraction
      currentStage = "METADATA_EXTRACTION";
      regexMetadata = extractMetadata(ocrResult.extractedText || "");

      // STEP 2.6 — GLiNER Entity Extraction (Shadow Mode)
      currentStage = "GLINER_EXTRACTION";
      glinerResult = await extractEntitiesWithGLiNER(ocrResult.extractedText || "");
      flatGlinerEntities = glinerResult.stakeholders || [];

      // STEP 2.65 - Rule-Based Document Classification (Shadow Mode)
      currentStage = "RULE_CLASSIFICATION";
      ruleClassification = classifyDocumentByRules(ocrResult.extractedText || "", regexMetadata);

      // CHECKPOINT #2 - Enrichment Persistence
      const existingMetadata = getPlainMetadata(document.metadata);
      const plainRegex = getPlainMetadata(regexMetadata);
      document.metadata = {
        ...existingMetadata,
        ...plainRegex,
        processingDiagnostics: {
          ...(existingMetadata.processingDiagnostics || {}),
          glinerSanitization: glinerResult.sanitization
        }
      };
      document.entities = flatGlinerEntities;
      checkpoint.enrichmentCompleted = true;


      await document.save();
    }

    // STEP 3 — AI Analysis (Routing via Orchestrator)
    currentStage = "AI_ANALYSIS";
    await updateProcessingHeartbeat(document, job); // Before AI
    
    let aiResult: any;
    let aiSuccess = false;
    let aiErrorMsg = "";
    
    let geminiShadowResult: any = null;
    let localLatency = 0;
    let geminiLatency = 0;

    if (checkpoint.aiCompleted) {
      console.log('[CHECKPOINT] AI already completed. Reusing stored AI results.');
      const plainMeta = getPlainMetadata(document.metadata);
      aiSuccess = plainMeta.aiStatus !== "FAILED";
      aiErrorMsg = plainMeta.aiError || "";
      aiResult = {
        summary: plainMeta.aiSummary || "",
        category: document.docType || "Other",
        tags: document.tags || [],
        entities: document.entities || [],
        suggestedFilename: plainMeta.suggestedFilename || document.documentName || "",
        summaryFields: plainMeta.summaryFields || {},
        metadata: {
          processingDiagnostics: plainMeta.processingDiagnostics || {}
        }
      };
    } else if (!ocrResult.extractedText || ocrResult.extractedText.trim().length === 0) {
      console.log('[AI_ANALYSIS] Skipping AI analysis: Empty OCR text.');
      aiSuccess = false;
      aiErrorMsg = "Skip AI processing: Empty OCR text.";
      aiResult = {
        summary: "AI analysis skipped (Empty OCR text)",
        category: "Other",
        tags: ["OCR_EMPTY"],
        entities: [],
        suggestedFilename: document.originalName.split('.')[0],
        rotation: 0,
        summaryFields: {},
        metadata: {
          processingDiagnostics: {
            aiDiagnostics: {
              provider: aiOrchestrator.getPrimaryProviderName(),
              success: false,
              failureReason: "Skip AI processing: Empty OCR text.",
              timestamp: new Date().toISOString()
            }
          }
        }
      };
      
      checkpoint.aiCompleted = true;
      const plainExisting = getPlainMetadata(document.metadata);
      document.metadata = {
        ...plainExisting,
        aiStatus: "FAILED",
        aiError: aiErrorMsg,
        aiSummary: aiResult.summary,
        aiCategory: aiResult.category,
        aiTags: aiResult.tags,
        suggestedFilename: aiResult.suggestedFilename
      };
      await document.save();
    } else {
      const isDigitalPdf = document.mimeType === "application/pdf" && ocrResult.strategy === "DIGITAL_DOCUMENT";
      const hasEnoughText = textLength > PDF_TEXT_THRESHOLD;

      try {
        const aiPerfStart = Date.now();
        
        if (isDigitalPdf && hasEnoughText) {
          geminiMode = "TEXT";
          console.log(`[ROUTING] TEXT_MODE via Orchestrator (length=${textLength})`);
          
          aiResult = await measureStep(documentId, "PRIMARY_AI_TEXT", async () => {
            return await aiOrchestrator.analyzeText(
              ocrResult.extractedText,
              document.originalName,
              {
                language: language,
                mimeType: document.mimeType,
                ocrConfidence: ocrResult.confidence,
                categoryHint: ruleClassification?.category
              }
            );
          });
        } else {
          geminiMode = "VISION";
          const reason = !isDigitalPdf ? "NOT_A_PDF" : "LOW_TEXT_CONFIDENCE";
          console.log(`[ROUTING] VISION_MODE via Orchestrator (reason=${reason}, length=${textLength})`);

          const fileBuffer = fs.readFileSync(document.storagePath);
          const base64Data = fileBuffer.toString("base64");
          
          aiResult = await measureStep(documentId, "PRIMARY_AI_VISION", async () => {
            return await aiOrchestrator.analyzeDocument(
              base64Data,
              document.mimeType,
              document.originalName,
              ocrResult.extractedText,
              {
                language: language,
                mimeType: document.mimeType,
                ocrConfidence: ocrResult.confidence,
                categoryHint: ruleClassification?.category
              }
            );
          });
        }
        aiSuccess = true;
        localLatency = Date.now() - aiPerfStart;
      } catch (err: any) {
        console.error("[PRIMARY_AI_FAILED_SWALLOWED] AI Orchestrator analysis failed:", err.message);
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

      // Save AI Checkpoint right after execution
      checkpoint.aiCompleted = true;
      const plainExisting = getPlainMetadata(document.metadata);
      document.metadata = {
        ...plainExisting,
        aiStatus: aiSuccess ? "SUCCESS" : "FAILED",
        aiError: aiSuccess ? undefined : aiErrorMsg,
        aiSummary: aiResult.summary,
        aiCategory: aiResult.category,
        aiTags: aiResult.tags,
        suggestedFilename: aiResult.suggestedFilename
      };
      await document.save();
      console.log(`[AI_ANALYSIS] Stage complete. Checkpoint saved. Success=${aiSuccess}`);
    }

    // STEP 2.7 — Table Extraction (Retry-Safe)
    const canExtractTables =
      ocrResult.strategy === "DIGITAL_DOCUMENT" ||
      ocrResult.strategy === "SCANNED_DOCUMENT";

    if (canExtractTables && !checkpoint.tablesCompleted) {
      currentStage = "TABLE_EXTRACTION";
      extractedTables = await extractTables(documentId, document.storagePath, ocrResult.strategy);

      if (extractedTables && extractedTables.success && extractedTables.totalTables > 0) {
        document.tables = extractedTables;
      } else {
        document.tables = extractedTables; // E.g., empty result
      }

      // Persist tables and update checkpoint
      checkpoint.tablesCompleted = true;
      try {

        await document.save();
        console.log(`[TABLES] Extraction complete. ${extractedTables?.totalTables || 0} tables found. Checkpoint saved.`);
      } catch (saveErr) {
        console.error("[TABLE_CHECKPOINT_SAVE_ERROR]", saveErr);
      }
    } else if (checkpoint.tablesCompleted) {
      console.log('[TABLES] Checkpoint found. Reusing existing tables.');
      extractedTables = document.tables || null;
    }

    // Phase 5C.3: Deterministic SummaryFields Builder
    currentStage = "SUMMARY_FIELDS_GENERATION";
    const summaryFieldsResult = buildSummaryFields(
      ruleClassification?.category || "Unknown",
      regexMetadata,
      { persons: flatGlinerEntities, organizations: flatGlinerEntities },
      extractedTables
    );

    // Save to metadata immediately without waiting for AI
    const plainSummaryExisting = getPlainMetadata(document.metadata);
    document.metadata = {
      ...plainSummaryExisting,
      summaryFields: summaryFieldsResult.fields,
      processingDiagnostics: {
        ...(plainSummaryExisting.processingDiagnostics || {}),
        summaryFieldsProvenance: summaryFieldsResult.diagnostics
      }
    };
      
      // Merge Regex Metadata with AI Metadata
      const mergedMetadata = {
        ...getPlainMetadata(regexMetadata),
        ...getPlainMetadata(aiResult.metadata)
      };
      aiResult.metadata = mergedMetadata;

      // Merge and deduplicate summaryFields
      const finalSummaryFields: Record<string, string> = {};
      const aiSummaryFields = aiResult.summaryFields || {};
      for (const [key, val] of Object.entries(aiSummaryFields)) {
        if (val) {
          finalSummaryFields[key] = String(val);
        }
      }
      
      const ruleFields = summaryFieldsResult?.fields || {};
      for (const [ruleKey, ruleVal] of Object.entries(ruleFields)) {
        if (ruleVal) {
          const lowerRuleKey = ruleKey.toLowerCase();
          const existingKey = Object.keys(finalSummaryFields).find(k => k.toLowerCase() === lowerRuleKey);
          if (existingKey) {
            delete finalSummaryFields[existingKey];
          }
          finalSummaryFields[ruleKey] = ruleVal;
        }
      }

      // Set combined fields back to metadata for mapping & database save
      aiResult.metadata.summaryFields = finalSummaryFields;
      
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

        if (geminiShadowResult) {
          const aiBenchmark = compareLocalVsGemini(
            aiResult,
            geminiShadowResult,
            localLatency,
            geminiLatency,
            ruleClassification.category || "Unknown"
          );

          aiResult.metadata.processingDiagnostics = {
            ...aiResult.metadata.processingDiagnostics,
            aiBenchmark
          };
        }

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
      console.log(`[AI_PERSISTENCE] Preparing unified persistence for Document: ${documentId}`);
      
      const vaultInfo = classifyDocument(aiResult.category);
      const update = mapDocumentUpdate(
        ocrResult,
        aiResult,
        vaultInfo,
        document.originalName,
        getPlainMetadata(document.metadata)
      );

      // Save comparison diagnostics and ensure GLiNER entities remain authoritative
      const existingDiag = getPlainMetadata(document.metadata?.processingDiagnostics || {});
      
      // Determine validation status & diagnostics details
      const fallbackUsed = aiResult.metadata?.processingDiagnostics?.fallbackUsed || null;
      const primaryError = aiResult.metadata?.processingDiagnostics?.primaryError || null;
      const selectedModel = aiResult.metadata?.processingDiagnostics?.localAnalysis?.model || "gemini-2.0-flash";
      
      const aiDiagnostics = {
        provider: fallbackUsed ? `${aiOrchestrator.getPrimaryProviderName()} (failed) -> ${fallbackUsed}` : aiOrchestrator.getPrimaryProviderName(),
        model: selectedModel,
        latencyMs: localLatency,
        success: aiSuccess,
        fallbackUsed: fallbackUsed,
        validationResult: "PASSED",
        ...(aiSuccess ? {} : { failureReason: aiErrorMsg || "Unknown AI error" }),
        primaryError: primaryError
      };

      const finalDiagnostics = {
        ...existingDiag,
        aiDiagnostics,
        entityComparison: {
          gliner: flatGlinerEntities,
          gemini: aiResult.entities || []
        },
        glinerEntitiesRaw: glinerResult?.stakeholderDiagnostics?.glinerEntitiesRaw || [],
        glinerEntitiesRanked: glinerResult?.stakeholderDiagnostics?.glinerEntitiesRanked || [],
        entityScores: glinerResult?.stakeholderDiagnostics?.entityScores || {},
        entityLabels: glinerResult?.stakeholderDiagnostics?.entityLabels || {}
      };

      const finalMetadata = {
        ...update.metadata,
        processingDiagnostics: finalDiagnostics,
        aiStatus: aiSuccess ? "SUCCESS" : "FAILED",
        aiError: aiSuccess ? undefined : aiErrorMsg,
        ocrStatus: "SUCCESS"
      };

      // Set checkpoint to completed
      checkpoint.aiCompleted = true;

      // STEP 6 — Final Status Update & Persistence
      currentStage = "PERSISTENCE";
      
      await measureStep(documentId, "DATABASE_SAVE", async () => {
        // Calculate and store AI Units usage
        const ocrPageCount = ocrResult?.pageCount || 1;
        const tablesExtractedCount = Array.isArray(document.tables)
          ? document.tables.length
          : (document.tables?.totalTables || 0);
        const hasEntities = (document.entities && document.entities.length > 0) || (aiResult?.entities && aiResult.entities.length > 0);
        const hasSummary = !!(finalMetadata.aiSummary || aiResult?.summary);
        const hasSuggestedFilename = !!(finalMetadata.suggestedFilename || aiResult?.suggestedFilename);
        const hasTags = (document.tags && document.tags.length > 0) || (aiResult?.tags && aiResult.tags.length > 0);
        const hasClassification = !!(update.vaultCategory || aiResult?.category);

        const calcResult = calculateAIUnitsForDocument({
          pageCount: ocrPageCount,
          tablesCount: tablesExtractedCount,
          hasEntities,
          hasSummary,
          hasSuggestedFilename,
          hasTags,
          hasClassification
        });

        const usage = {
          aiUnits: calcResult.aiUnits,
          processingRuns: (document.usage?.processingRuns || 0) + 1,
          calculatorVersion: calcResult.calculatorVersion,
          calculatedAt: calcResult.calculatedAt,
          breakdown: calcResult.breakdown
        };

        const statusValue = (!aiSuccess && !checkpoint.aiCompleted) || 
                            (!aiSuccess && checkpoint.aiCompleted && finalMetadata.aiStatus === "FAILED") 
                            ? "PARTIAL_SUCCESS" : "COMPLETED";

        // Increment User-Level cumulative stats if userId exists
        if (document.userId) {
          const User = require('../models/User').default;
          await User.findByIdAndUpdate(
            document.userId,
            {
              $inc: {
                "usage.totalAiUnits": calcResult.aiUnits,
                "usage.totalProcessingRuns": 1
              }
            }
          );
          console.log(`[USER USAGE] Incremented total usage metrics for User ${document.userId} by ${calcResult.aiUnits} units.`);
        }

        // Perform ONE unified, authoritative update database save
        await Document.findByIdAndUpdate(
          documentId,
          {
            $set: {
              extractedText: update.extractedText,
              ocrConfidence: update.ocrConfidence,
              processingStrategy: update.processingStrategy,
              docType: update.docType,
              tags: update.tags,
              documentName: update.documentName,
              vaultCategory: update.vaultCategory,
              vaultFolder: update.vaultFolder,
              metadata: finalMetadata,
              entities: flatGlinerEntities, // Authoritative entities
              status: statusValue,
              processingCheckpoint: checkpoint,
              processingCompletedAt: new Date(),
              usage: usage
            }
          },
          { new: true, runValidators: true }
        );
        
        emitDocumentStatus(documentId, statusValue);

        if (job) {
          job.status = statusValue;
          if (statusValue === "PARTIAL_SUCCESS") {
            job.errorMessage = `AI Analysis failed or was skipped. Error: ${aiErrorMsg || "Service unavailable"}`;
          }
          job.completedAt = new Date();
          await job.save();
        }
      });
    
    const freshDoc = await Document.findById(documentId);
    if (freshDoc) await updateProcessingHeartbeat(freshDoc, job); // After Save

    const totalDurationMs = Date.now() - totalPerfStart;
    
    // FINAL BENCHMARK LOG
    logMetric({
      documentId,
      stepName: "TOTAL_PROCESSING",
      durationMs: totalDurationMs,
      metadata: {
        mimeType: document.mimeType,
        pageCount: Array.isArray(document.tables)
          ? (document.tables.length ? Math.max(...document.tables.map((t: any) => t.pageNumber || 1)) : 1)
          : (document.tables?.pagesWithTables?.length ? Math.max(...document.tables.pagesWithTables) : 1),
        geminiMode,
        textLength,
        classification,
        largeDocument: classification !== "NORMAL_DOCUMENT",
        tablesFound: Array.isArray(document.tables)
          ? (document.tables.length || 0)
          : (document.tables?.totalTables || 0),
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
    emitDocumentStatus(documentId, "FAILED");


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
