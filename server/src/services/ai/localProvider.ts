import { IAIProvider } from './aiProvider';
import { AIAnalysisResult } from './types';

export class LocalProvider implements IAIProvider {
  async analyzeText(text: string, fileName: string): Promise<AIAnalysisResult> {
    throw new Error('LocalProvider.analyzeText not implemented yet.');
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult> {
    throw new Error('LocalProvider.analyzeDocument not implemented yet. (Consider falling back to analyzeText with OCR data)');
  }
}
