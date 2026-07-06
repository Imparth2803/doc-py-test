// Unit cost weights configuration for all document AI operations
export const AI_UNIT_WEIGHTS = {
  OCR_BASE: 1.0,          // Base OCR initialization
  OCR_PER_PAGE: 1.5,      // Cost per page processed
  TABLES_BASE: 2.0,       // Base tables engine initialization
  TABLES_PER_TABLE: 1.0,  // Cost per extracted table sheet
  ENTITIES: 1.5,          // Named entity extraction using GLiNER/shadow mode
  SUMMARY: 2.0,           // Ollama/Gemini summary generation
  FILENAME: 0.5,          // Suggested file naming
  TAGS: 0.5,              // Dynamic tags generation
  CLASSIFICATION: 1.0     // Rule-based classification
};
