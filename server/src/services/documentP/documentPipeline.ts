import { extractTextWithPaddle } from '../ocr/paddleService';

import {
  analyzeWithLocalModel,
} from '../ai/localModelService';

import {
  evaluateConfidence,
} from '../ai/confidenceService';

export const processDocument =
  async (filePath: string) => {
    const extractedText =
      await extractTextWithPaddle(
        filePath
      );

    const aiResult =
      await analyzeWithLocalModel(
        extractedText,
        filePath
      );

    const confidence =
      evaluateConfidence(aiResult);

    return {
      extractedText,
      aiResult,
      confidence,
    };
  };