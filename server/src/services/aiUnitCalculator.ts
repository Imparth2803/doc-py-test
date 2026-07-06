import { AI_UNIT_WEIGHTS } from './aiUnitWeights';

export interface AIUnitsBreakdown {
  ocr: number;
  tables: number;
  entities: number;
  summary: number;
  filename: number;
  tags: number;
  classification: number;
}

export interface AIUnitsResult {
  aiUnits: number;
  breakdown: AIUnitsBreakdown;
  calculatorVersion: string;
  calculatedAt: Date;
}

/**
 * Calculates consumed AI Units and generates a breakdown for document operations.
 * This is decoupled from MongoDB models and works purely on raw data inputs.
 */
export function calculateAIUnitsForDocument(params: {
  pageCount?: number;
  tablesCount?: number;
  hasEntities?: boolean;
  hasSummary?: boolean;
  hasSuggestedFilename?: boolean;
  hasTags?: boolean;
  hasClassification?: boolean;
}): AIUnitsResult {
  const ocr = params.pageCount ? AI_UNIT_WEIGHTS.OCR_BASE + (params.pageCount * AI_UNIT_WEIGHTS.OCR_PER_PAGE) : 0;
  
  let tables = 0;
  if (params.tablesCount !== undefined && params.tablesCount > 0) {
    tables = AI_UNIT_WEIGHTS.TABLES_BASE + (params.tablesCount * AI_UNIT_WEIGHTS.TABLES_PER_TABLE);
  }
  
  const entities = params.hasEntities ? AI_UNIT_WEIGHTS.ENTITIES : 0;
  const summary = params.hasSummary ? AI_UNIT_WEIGHTS.SUMMARY : 0;
  const filename = params.hasSuggestedFilename ? AI_UNIT_WEIGHTS.FILENAME : 0;
  const tags = params.hasTags ? AI_UNIT_WEIGHTS.TAGS : 0;
  const classification = params.hasClassification ? AI_UNIT_WEIGHTS.CLASSIFICATION : 0;
  
  const total = ocr + tables + entities + summary + filename + tags + classification;
  
  // Format to 1 decimal place to prevent floating point issues in presentation
  const aiUnits = Math.round(total * 10) / 10;
  
  return {
    aiUnits,
    breakdown: {
      ocr: Math.round(ocr * 10) / 10,
      tables: Math.round(tables * 10) / 10,
      entities: Math.round(entities * 10) / 10,
      summary: Math.round(summary * 10) / 10,
      filename: Math.round(filename * 10) / 10,
      tags: Math.round(tags * 10) / 10,
      classification: Math.round(classification * 10) / 10
    },
    calculatorVersion: '1.1.0',
    calculatedAt: new Date()
  };
}
