import { AIAnalysisResult } from './types';

export interface IAIProvider {
  analyzeText(text: string, fileName: string): Promise<AIAnalysisResult>;
  analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult>;
}
