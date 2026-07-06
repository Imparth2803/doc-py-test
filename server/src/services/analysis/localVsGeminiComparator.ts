import { AIAnalysisResult } from '../ai/types';

export const compareLocalVsGemini = (
  localResult: AIAnalysisResult,
  geminiResult: AIAnalysisResult,
  localLatency: number,
  geminiLatency: number,
  category: string
) => {
  // Tags metrics
  const localTags = new Set(localResult.tags.map(t => t.toLowerCase()));
  const geminiTags = new Set(geminiResult.tags.map(t => t.toLowerCase()));
  
  let overlapCount = 0;
  localTags.forEach(tag => {
    if (geminiTags.has(tag)) overlapCount++;
  });
  
  const totalTags = new Set([...localTags, ...geminiTags]).size;
  const overlapPercentage = totalTags > 0 ? (overlapCount / totalTags) : 0;
  const localOnly = localTags.size - overlapCount;
  const geminiOnly = geminiTags.size - overlapCount;

  // Summary Metrics
  const lengthRatio = geminiResult.summary.length > 0 ? (localResult.summary.length / geminiResult.summary.length) : 0;

  console.log('\n=================================');
  console.log('AI PROVIDER BENCHMARK');
  console.log('=================================');
  console.log(`Document: ${category}`);
  console.log(`Primary: Qwen2.5:1.5B`);
  console.log(`Summary Length: ${localResult.summary.length}`);
  console.log(`Tags: ${localResult.tags.length}`);
  console.log(`Filename Generated: ${localResult.suggestedFilename && localResult.suggestedFilename !== "Unknown" ? 'Yes' : 'No'}`);
  console.log(`Latency: ${localLatency}ms`);
  console.log('---------------------------------');
  console.log(`Gemini Shadow`);
  console.log(`Summary Length: ${geminiResult.summary.length}`);
  console.log(`Tags: ${geminiResult.tags.length}`);
  console.log(`Latency: ${geminiLatency}ms`);
  console.log('---------------------------------');
  console.log(`Tag Overlap: ${(overlapPercentage * 100).toFixed(1)}%`);
  console.log(`Local Only Tags: ${localOnly} | Gemini Only Tags: ${geminiOnly}`);
  console.log(`Summary Length Ratio: ${lengthRatio.toFixed(2)}`);
  console.log('=================================\n');

  return {
    tags: {
      overlapPercentage,
      localOnly,
      geminiOnly
    },
    summary: {
      lengthRatio
    }
  };
};
