import { ClassificationComparisonResult, DocumentCategory, RuleClassificationResult } from './classificationTypes';

const normalizeCategory = (cat: string): string => {
  return cat.toLowerCase().replace(/[\s_-]+/g, '');
};

export const compareClassifications = (
  ruleResult: RuleClassificationResult, 
  geminiCategory: string
): ClassificationComparisonResult => {
  const normRule = normalizeCategory(ruleResult.category);
  const normGemini = normalizeCategory(geminiCategory);

  const normalizedMatch = normRule === normGemini;

  // Strict match (usually they differ slightly in casing/spacing)
  const exactMatch = ruleResult.category.toLowerCase() === geminiCategory.toLowerCase();

  return {
    match: exactMatch || normalizedMatch,
    normalizedMatch,
    ruleCategory: ruleResult.category,
    geminiCategory,
    confidence: ruleResult.confidence
  };
};

export const printClassificationBenchmark = (comp: ClassificationComparisonResult) => {
  console.log('\n=================================');
  console.log('Classification Benchmark');
  console.log('=================================');
  console.log(`Rule Category:`);
  console.log(comp.ruleCategory);
  console.log(`\nRule Confidence:`);
  console.log(comp.confidence.toFixed(2));
  console.log(`\nGemini Category:`);
  console.log(comp.geminiCategory);
  console.log(`\nMatch:`);
  console.log(comp.match ? 'TRUE' : 'FALSE');
  console.log('=================================\n');
};
