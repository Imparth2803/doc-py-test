import { LocalDocumentAnalysis } from './localDocumentAnalyzer';

export const printAnalysisBenchmark = (
  category: string,
  localResult: LocalDocumentAnalysis,
  geminiResult: { summary: string; tags: string[]; suggestedFilename: string }
) => {
  console.log('\n=================================');
  console.log('LOCAL DOCUMENT ANALYSIS BENCHMARK');
  console.log('=================================');
  console.log(`Category: ${category}`);
  console.log(`Model: ${localResult.diagnostics.model}`);
  console.log(`Summary Length: ${localResult.diagnostics.summaryGenerated ? localResult.summary.length : 0}`);
  console.log(`Gemini Summary Length: ${geminiResult.summary?.length || 0}`);
  console.log(`Tag Count: ${localResult.diagnostics.generatedTagCount}`);
  console.log(`Gemini Tag Count: ${geminiResult.tags?.length || 0}`);
  console.log(`Filename Generated: ${localResult.diagnostics.filenameGenerated ? 'Yes' : 'No'}`);
  console.log(`Latency: ${localResult.diagnostics.latencyMs}ms`);
  console.log(`Truncated Input: ${localResult.diagnostics.truncated}`);
  console.log('=================================\n');
};
