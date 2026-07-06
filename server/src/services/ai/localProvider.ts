import { IAIProvider } from './aiProvider';
import { AIAnalysisResult } from './types';
import { analyzeDocumentLocally } from '../analysis/localDocumentAnalyzer';

export class LocalProvider implements IAIProvider {
  async analyzeText(text: string, fileName: string): Promise<AIAnalysisResult> {
    const analysis = await analyzeDocumentLocally(text);
    
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

    let validFilename = analysis.suggestedFilename || fileName;
    validFilename = validFilename.replace(/[\/\\:*?"<>|]/g, '').slice(0, 80);
    // Remove extension if AI generated one
    validFilename = validFilename.replace(/\.(pdf|jpg|jpeg|png)$/i, '').trim();

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

  async analyzeDocument(base64Data: string, mimeType: string, fileName: string): Promise<AIAnalysisResult> {
    throw new Error('LocalProvider.analyzeDocument not implemented yet. (Consider falling back to analyzeText with OCR data)');
  }
}
