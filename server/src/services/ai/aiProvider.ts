import { AIAnalysisResult } from './types';

export interface IAIProvider {
  analyzeText(text: string, fileName: string, options?: any): Promise<AIAnalysisResult>;
  analyzeDocument(base64Data: string, mimeType: string, fileName: string, extractedText?: string, options?: any): Promise<AIAnalysisResult>;
}
