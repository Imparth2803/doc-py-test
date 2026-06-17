import { DocumentCategory, RuleClassificationResult } from './classificationTypes';
import { CLASSIFICATION_RULES } from './classificationRules';
import { ExtractedMetadata } from '../metadata/types';

export const classifyDocumentByRules = (text: string, metadata: ExtractedMetadata): RuleClassificationResult => {
  const normalizedText = text.toLowerCase();
  
  let bestCategory = DocumentCategory.OTHER;
  let bestScore = 0;
  let bestMatchedRules: string[] = [];
  let bestEvidence: string[] = [];

  for (const rule of CLASSIFICATION_RULES) {
    let currentScore = 0;
    const currentMatchedRules: string[] = [];
    const currentEvidence: string[] = [];

    // Check required regex
    if (rule.requiredRegex) {
      const passed = rule.requiredRegex(metadata);
      if (!passed) {
        continue; // Skip this category if a hard requirement isn't met
      }
      currentScore += 30; // Base score for hitting a required regex
      currentMatchedRules.push('required_regex_match');
      currentEvidence.push('Regex hard requirement met');
    }

    // Keyword scoring
    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword.phrase.toLowerCase())) {
        currentScore += keyword.score;
        currentMatchedRules.push(`keyword:${keyword.phrase}`);
        currentEvidence.push(`Found keyword: "${keyword.phrase}"`);
      }
    }

    // Regex bonus scoring
    if (rule.regexBonus) {
      for (let i = 0; i < rule.regexBonus.length; i++) {
        const bonus = rule.regexBonus[i];
        if (bonus.check(metadata)) {
          currentScore += bonus.score;
          currentMatchedRules.push(`regex_bonus_${i}`);
          currentEvidence.push(`Met regex bonus condition ${i}`);
        }
      }
    }

    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestCategory = rule.category;
      bestMatchedRules = currentMatchedRules;
      bestEvidence = currentEvidence;
    }
  }

  // Convert raw score to a synthetic confidence bounded by 0.99
  // We assume 80+ is extremely high confidence
  let confidence = 0;
  if (bestScore > 0) {
    confidence = Math.min(bestScore / 100, 0.99);
  }

  // Minimum threshold for rules
  if (confidence < 0.70) {
    return {
      category: DocumentCategory.OTHER,
      confidence,
      matchedRules: bestMatchedRules,
      evidence: bestEvidence
    };
  }

  return {
    category: bestCategory,
    confidence,
    matchedRules: bestMatchedRules,
    evidence: bestEvidence
  };
};
