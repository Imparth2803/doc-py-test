import { AIAnalysisResult } from './types';

export const evaluateConfidence = (
  result: AIAnalysisResult
): number => {
  let score = 1;

  if (!result.tags?.length)
    score -= 0.3;

  if (!result.entities?.length)
    score -= 0.2;

  if (!result.summary)
    score -= 0.2;

  return Math.max(score, 0);
};