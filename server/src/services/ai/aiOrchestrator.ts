import { IAIProvider } from './aiProvider';
import { GeminiProvider } from './geminiProvider';
import { LocalProvider } from './localProvider';
import { AIAnalysisResult } from './types';

function validateResponse(result: any, fileName: string): void {
  if (!result || typeof result !== 'object') {
    throw new Error("AI response is not a valid object.");
  }
  if (typeof result.summary !== 'string' || result.summary.trim().length === 0) {
    throw new Error("AI response missing or empty 'summary' field.");
  }
  if (typeof result.suggestedFilename !== 'string' || result.suggestedFilename.trim().length === 0) {
    throw new Error("AI response missing or empty 'suggestedFilename' field.");
  }
  if (!Array.isArray(result.tags)) {
    throw new Error("AI response missing or invalid 'tags' array.");
  }
  if (typeof result.category !== 'string' || result.category.trim().length === 0) {
    throw new Error("AI response missing or empty 'category' field.");
  }
  if (result.entities && !Array.isArray(result.entities)) {
    result.entities = [];
  }
  if (!result.summaryFields || typeof result.summaryFields !== 'object') {
    result.summaryFields = {};
  }
}

export class AIOrchestrator {
  private primaryProvider: IAIProvider;
  private fallbackProvider: IAIProvider | null = null;
  private shadowProvider: IAIProvider | null = null;
  private providerName: string;
  private fallbackProviderName: string | null = null;

  constructor() {
    const provider = process.env.PRIMARY_AI_PROVIDER || 'gemini';
    this.providerName = provider;
    
    if (provider === 'local') {
      console.log('[AI_ORCHESTRATOR] Initializing LocalProvider as PRIMARY');
      this.primaryProvider = new LocalProvider();
    } else {
      console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider as PRIMARY');
      this.primaryProvider = new GeminiProvider();
    }

    const fallback = process.env.FALLBACK_AI_PROVIDER || (provider === 'gemini' ? 'local' : 'gemini');
    if (fallback && fallback !== provider && fallback !== 'none') {
      this.fallbackProviderName = fallback;
      if (fallback === 'local') {
        console.log('[AI_ORCHESTRATOR] Initializing LocalProvider as FALLBACK');
        this.fallbackProvider = new LocalProvider();
      } else {
        console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider as FALLBACK');
        this.fallbackProvider = new GeminiProvider();
      }
    }
    
    if (provider === 'local' && process.env.ENABLE_GEMINI_SHADOW === 'true') {
      console.log('[AI_ORCHESTRATOR] Initializing GeminiProvider as SHADOW');
      this.shadowProvider = new GeminiProvider();
    }
  }

  getPrimaryProviderName(): string {
    return this.providerName;
  }

  getShadowProvider(): IAIProvider | null {
    return this.shadowProvider;
  }

  async analyzeText(text: string, fileName: string, options?: any): Promise<AIAnalysisResult> {
    try {
      console.log(`[AI_ORCHESTRATOR] Trying primary provider: ${this.providerName}`);
      const result = await this.primaryProvider.analyzeText(text, fileName, options);
      validateResponse(result, fileName);
      return result;
    } catch (err: any) {
      console.warn(`[AI_ORCHESTRATOR] Primary provider ${this.providerName} failed: ${err.message}`);
      if (this.fallbackProvider) {
        console.log(`[AI_ORCHESTRATOR] Falling back to provider: ${this.fallbackProviderName}`);
        try {
          const result = await this.fallbackProvider.analyzeText(text, fileName, options);
          validateResponse(result, fileName);
          if (!result.metadata) result.metadata = {};
          if (!result.metadata.processingDiagnostics) result.metadata.processingDiagnostics = {};
          result.metadata.processingDiagnostics.fallbackUsed = this.fallbackProviderName;
          result.metadata.processingDiagnostics.primaryError = err.message;
          return result;
        } catch (fallbackErr: any) {
          console.error(`[AI_ORCHESTRATOR] Fallback provider ${this.fallbackProviderName} also failed: ${fallbackErr.message}`);
          throw new Error(`Both primary (${this.providerName}) and fallback (${this.fallbackProviderName}) providers failed. Errors: [Primary: ${err.message}], [Fallback: ${fallbackErr.message}]`);
        }
      }
      throw err;
    }
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string, extractedText?: string, options?: any): Promise<AIAnalysisResult> {
    try {
      console.log(`[AI_ORCHESTRATOR] Trying primary provider: ${this.providerName}`);
      if (this.providerName === 'local' && extractedText) {
        console.log('[AI_ORCHESTRATOR] Local provider does not support vision. Falling back to analyzeText with OCR data.');
        const result = await this.primaryProvider.analyzeText(extractedText, fileName, options);
        validateResponse(result, fileName);
        return result;
      }
      const result = await this.primaryProvider.analyzeDocument(base64Data, mimeType, fileName, extractedText, options);
      validateResponse(result, fileName);
      return result;
    } catch (err: any) {
      console.warn(`[AI_ORCHESTRATOR] Primary provider ${this.providerName} failed: ${err.message}`);
      if (this.fallbackProvider) {
        console.log(`[AI_ORCHESTRATOR] Falling back to provider: ${this.fallbackProviderName}`);
        try {
          if (this.fallbackProviderName === 'local' && extractedText) {
            console.log('[AI_ORCHESTRATOR] Fallback Local provider does not support vision. Using analyzeText with OCR data.');
            const result = await this.fallbackProvider.analyzeText(extractedText, fileName, options);
            validateResponse(result, fileName);
            if (!result.metadata) result.metadata = {};
            if (!result.metadata.processingDiagnostics) result.metadata.processingDiagnostics = {};
            result.metadata.processingDiagnostics.fallbackUsed = this.fallbackProviderName;
            result.metadata.processingDiagnostics.primaryError = err.message;
            return result;
          }
          const result = await this.fallbackProvider.analyzeDocument(base64Data, mimeType, fileName, extractedText, options);
          validateResponse(result, fileName);
          if (!result.metadata) result.metadata = {};
          if (!result.metadata.processingDiagnostics) result.metadata.processingDiagnostics = {};
          result.metadata.processingDiagnostics.fallbackUsed = this.fallbackProviderName;
          result.metadata.processingDiagnostics.primaryError = err.message;
          return result;
        } catch (fallbackErr: any) {
          console.error(`[AI_ORCHESTRATOR] Fallback provider ${this.fallbackProviderName} also failed: ${fallbackErr.message}`);
          throw new Error(`Both primary (${this.providerName}) and fallback (${this.fallbackProviderName}) providers failed. Errors: [Primary: ${err.message}], [Fallback: ${fallbackErr.message}]`);
        }
      }
      throw err;
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();

