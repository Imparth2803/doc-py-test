import { IAIProvider } from './aiProvider';
import { AIAnalysisResult } from './types';
import { analyzeDocumentLocally } from '../analysis/localDocumentAnalyzer';
import { cleanAndValidateFilename } from '../../utils/filenameUtils';

export class LocalProvider implements IAIProvider {
  async analyzeText(text: string, fileName: string, options?: any): Promise<AIAnalysisResult> {
    const analysis = await analyzeDocumentLocally(text, options?.categoryHint, undefined, {
      fileName,
      language: options?.language,
      mimeType: options?.mimeType,
      ocrConfidence: options?.ocrConfidence
    });
    
    if (!analysis.diagnostics || !analysis.diagnostics.success) {
      throw new Error("Local Ollama analysis failed: " + ((analysis.diagnostics as any).error || "Ollama service is unreachable or returned invalid diagnostics."));
    }
    
    // Phase 5: Output Validation
    let validSummary = analysis.summary;
    if (!validSummary || validSummary.length < 20 || validSummary.length > 1000 || /^(N\/A|Unknown|Empty)$/i.test(validSummary)) {
      validSummary = "Document processed locally. Summary unavailable.";
    }

    const badTags = ['document', 'file', 'paper', 'scan', 'image', 'pdf'];
    const validTags = Array.from(new Set(
      (analysis.tags || [])
        .map(t => t.toLowerCase().trim())
        .filter(t => t.length > 0 && !badTags.includes(t))
    )).slice(0, 10); // Max 10 tags

    const validFilename = cleanAndValidateFilename(analysis.suggestedFilename || "", fileName, analysis.category);

    return {
      summary: validSummary,
      category: analysis.category || "Unknown",
      tags: validTags,
      entities: [], // GLiNER handles this
      suggestedFilename: validFilename,
      summaryFields: {}, // Local SLM doesn't extract this reliably yet
      metadata: {
        processingDiagnostics: {
          localAnalysis: analysis.diagnostics
        }
      }
    };
  }

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string, extractedText?: string, options?: any): Promise<AIAnalysisResult> {
    throw new Error('LocalProvider.analyzeDocument not implemented yet. (Consider falling back to analyzeText with OCR data)');
  }
}
