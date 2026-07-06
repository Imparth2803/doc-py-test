import { IAIProvider } from './aiProvider';
import { GeminiProvider } from './geminiProvider';
import { LocalProvider } from './localProvider';
import { AIAnalysisResult } from './types';

export class AIOrchestrator {
  private primaryProvider: IAIProvider;
  private shadowProvider: IAIProvider | null = null;
  private providerName: string;

  constructor() {
    const provider = process.env.PRIMARY_AI_PROVIDER || 'gemini';
    this.providerName = provider;
    
    if (provider === 'local') {
      console.log('[AI_ORCHESTRATOR] Initializing LocalProvider as PRIMARY');
      this.primaryProvider = new LocalProvider();
      
      if (process.env.ENABLE_GEMINI_SHADOW === 'true') {
        console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider as SHADOW');
        this.shadowProvider = new GeminiProvider();
      }
    } else {
      console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider as PRIMARY');
      this.primaryProvider = new GeminiProvider();
    }
  }

  getPrimaryProviderName(): string {
    return this.providerName;
  }

  getShadowProvider(): IAIProvider | null {
    return this.shadowProvider;
  }

  async analyzeText(text: string, fileName: string): Promise<AIAnalysisResult> {
    return this.primaryProvider.analyzeText(text, fileName);
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult> {
    // Local provider doesn't support vision natively yet, but orchestrator handles routing
    return this.primaryProvider.analyzeDocument(base64Data, mimeType, fileName);
  }
}

export const aiOrchestrator = new AIOrchestrator();

