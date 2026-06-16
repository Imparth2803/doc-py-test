// server/src/services/ai/types.ts

export interface AIAnalysisResult {
  summary: string;
  category: string;
  tags: string[];
  entities: string[];
  suggestedFilename: string;
  rotation?: number;
  summaryFields?: Record<string, string>;
  metadata?: Record<string, any>;
}
