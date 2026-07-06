import { AIAnalysisResult } from './ai/types';
import { VaultClassification } from './classification/vaultClassifier';
import { getPlainMetadata } from '../utils/metadataUtils';

export interface OCRResult {
  extractedText: string;
  confidence: number;
  strategy: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' | 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';
  angle?: number;
  orientationConfidence?: number;
  pageCount?: number;
}

/**
 * Normalizes legacy strategy names to new semantic names.
 * Ensures backward compatibility with existing database records.
 */
export const normalizeProcessingStrategy = (strategy: string): string => {
  switch (strategy) {
    case 'TEXT_ONLY':
      return 'DIGITAL_DOCUMENT';
    case 'VISION_FALLBACK':
      return 'SCANNED_DOCUMENT';
    default:
      return strategy;
  }
};


/**
 * Maps the results of OCR, AI Extraction, and Vault Classification 
 * into a single update object for the Document model.
 */
export const mapDocumentUpdate = (
  ocrResult: OCRResult, 
  aiResult: AIAnalysisResult, 
  vaultInfo: VaultClassification,
  originalName: string,
  existingMetadata: Record<string, any> = {}
) => {
  const plainExisting = getPlainMetadata(existingMetadata);
  const plainAiMetadata = getPlainMetadata(aiResult?.metadata);

  return {
    extractedText: ocrResult.extractedText,
    ocrConfidence: ocrResult.confidence,
    processingStrategy: normalizeProcessingStrategy(ocrResult.strategy),
    
    // AI Standardized fields
    docType: aiResult.category,
    tags: aiResult.tags,
    
    // Naming
    documentName: aiResult.suggestedFilename || originalName,
    
    // Metadata (Flat structure for frontend compatibility)
    metadata: {
      ...plainExisting,
      aiSummary: aiResult.summary,
      aiCategory: aiResult.category,
      aiTags: aiResult.tags,
      aiEntities: aiResult.entities,
      suggestedFilename: aiResult.suggestedFilename,
      ...plainAiMetadata, // Spread dynamic technical metadata (dates/amounts)
      processingDiagnostics: {
        ...(plainExisting.processingDiagnostics || {}),
        ...(plainAiMetadata.processingDiagnostics || {})
      }
    },
    
    // Organization
    vaultCategory: vaultInfo.vaultCategory,
    vaultFolder: vaultInfo.vaultFolder,
    
    // Status
    status: 'COMPLETED' as const
  };
};

