import { EntityComparisonResult } from './types';

// Simple string normalization for comparison (lowercase, remove punctuation, extra spaces)
const normalizeString = (str: string): string => {
  return str.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
};

const getTokens = (str: string) => new Set(normalizeString(str).split(/\s+/).filter(w => w.length > 0));

const tokenSimilarity = (a: string, b: string): number => {
  const setA = getTokens(a);
  const setB = getTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
};

export const compareEntities = (geminiEntities: string[], glinerEntities: string[]): EntityComparisonResult => {
  const geminiNorm = geminiEntities.map(normalizeString);
  const glinerNorm = glinerEntities.map(normalizeString);

  const overlap: string[] = [];
  const geminiOnly: string[] = [];
  const glinerOnly: string[] = [];
  
  let exactOverlapCount = 0;
  let fuzzyOverlapCount = 0;

  // Find overlap and Gemini-only
  for (let i = 0; i < geminiEntities.length; i++) {
    const orig = geminiEntities[i];
    const norm = geminiNorm[i];
    
    if (glinerNorm.includes(norm)) {
      overlap.push(orig);
      exactOverlapCount++;
      fuzzyOverlapCount++;
    } else {
      // Check fuzzy match
      const hasFuzzyMatch = glinerEntities.some(g => tokenSimilarity(orig, g) >= 0.5);
      if (hasFuzzyMatch) {
        fuzzyOverlapCount++;
        // We still count it as Gemini-only in terms of exact string content for legacy reporting,
        // but it is captured in fuzzyOverlapCount. Let's add it to overlap array for visibility if desired.
        // Wait, requirements say "Add exactOverlapCount, fuzzyOverlapCount for diagnostics." 
        // We'll keep the overlap array purely for exact matches or include fuzzy ones. Let's keep it exact, 
        // and just increment fuzzyOverlapCount.
      }
      geminiOnly.push(orig);
    }
  }

  // Find GLiNER-only
  for (let i = 0; i < glinerEntities.length; i++) {
    const orig = glinerEntities[i];
    const norm = glinerNorm[i];
    if (!geminiNorm.includes(norm)) {
      glinerOnly.push(orig);
    }
  }

  const result: EntityComparisonResult = {
    exactOverlapCount,
    fuzzyOverlapCount,
    geminiOnlyCount: geminiOnly.length,
    glinerOnlyCount: glinerOnly.length,
    overlap,
    geminiOnly,
    glinerOnly
  };

  return result;
};
