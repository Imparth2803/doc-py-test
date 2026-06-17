import { IAIProvider } from './aiProvider';
import { GeminiProvider } from './geminiProvider';
import { LocalProvider } from './localProvider';
import { AIAnalysisResult } from './types';

export class AIOrchestrator implements IAIProvider {
  private provider: IAIProvider;

  constructor() {
    const providerType = process.env.AI_PROVIDER || 'gemini';
    if (providerType === 'local') {
      console.log('[AI_ORCHESTRATOR] Initializing LocalProvider');
      this.provider = new LocalProvider();
    } else {
      console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider');
      this.provider = new GeminiProvider();
    }
  }

  async analyzeText(text: string, fileName: string): Promise<AIAnalysisResult> {
    return this.provider.analyzeText(text, fileName);
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult> {
    return this.provider.analyzeDocument(base64Data, mimeType, fileName);
  }
}

export const aiOrchestrator = new AIOrchestrator();
