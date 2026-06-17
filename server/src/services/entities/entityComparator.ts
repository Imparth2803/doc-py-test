import { EntityComparisonResult } from './types';

// Simple string normalization for comparison (lowercase, remove punctuation, extra spaces)
const normalizeString = (str: string): string => {
  return str.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
};

export const compareEntities = (geminiEntities: string[], glinerEntities: string[]): EntityComparisonResult => {
  const geminiNorm = geminiEntities.map(normalizeString);
  const glinerNorm = glinerEntities.map(normalizeString);

  const overlap: string[] = [];
  const geminiOnly: string[] = [];
  const glinerOnly: string[] = [];

  // Find overlap and Gemini-only
  for (let i = 0; i < geminiEntities.length; i++) {
    const orig = geminiEntities[i];
    const norm = geminiNorm[i];
    if (glinerNorm.includes(norm)) {
      overlap.push(orig);
    } else {
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
    overlapCount: overlap.length,
    geminiOnlyCount: geminiOnly.length,
    glinerOnlyCount: glinerOnly.length,
    overlap,
    geminiOnly,
    glinerOnly
  };

  console.log('\n==============================');
  console.log('Entity Comparison');
  console.log('==============================');
  console.log(`Gemini Entities: ${geminiEntities.length}`);
  console.log(`GLiNER Entities: ${glinerEntities.length}\n`);
  console.log(`Overlap: ${result.overlapCount}`);
  console.log(`Gemini Only: ${result.geminiOnlyCount}`);
  console.log(`GLiNER Only: ${result.glinerOnlyCount}`);
  console.log('==============================\n');

  return result;
};
