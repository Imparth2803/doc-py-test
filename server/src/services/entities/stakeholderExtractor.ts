import { GLiNEREntity } from './types';

const REJECT_NETWORKS = ['VISA', 'AMEX', 'INTERAC', 'MASTERCARD', 'RUPAY'];

const MONTHS_REGEX = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;

// Regex to catch OCR concatenation artifacts ending with a month name (e.g., TechnologyFeb, CompanyJan)
const OCR_MONTH_SUFFIX_REGEX = /[a-z]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/;

const DATE_REGEX = /\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/;

export interface RankedEntity {
  text: string;
  label: string;
  score: number;
}

export interface StakeholderDiagnostics {
  glinerEntitiesRaw: string[];
  glinerEntitiesRanked: string[];
  entityScores: Record<string, number>;
  entityLabels: Record<string, string>;
}

/**
 * Normalizes entity text.
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Checks if the entity matches any rejection rule.
 */
function isRejected(text: string, label: string): boolean {
  const norm = text.toUpperCase();
  const lower = text.toLowerCase();
  const labelNorm = label.toUpperCase();

  // 0. Only allow PERSON and ORGANIZATION labels
  if (labelNorm !== 'PERSON' && labelNorm !== 'ORGANIZATION') return true;

  // 1. Single character
  if (text.length <= 1) return true;

  // 2. Pure numeric values
  if (/^\d+$/.test(text)) return true;

  // 3. Payment Card Networks
  if (REJECT_NETWORKS.some(net => norm === net)) return true;

  // 4. Months / Dates
  if (MONTHS_REGEX.test(lower)) return true;
  if (DATE_REGEX.test(lower)) return true;

  // 5. OCR artifacts / month suffixes
  if (OCR_MONTH_SUFFIX_REGEX.test(text)) return true;

  // 6. Page numbers / Reference numbers / IDs
  if (/^(page|pg|ref|txn|id|acc|account|invoice|receipt)\s*#?[0-9]+/i.test(lower)) return true;
  if (/^[A-Z0-9-]{8,}$/.test(norm) && /\d/.test(norm) && /[A-Z]/.test(norm)) return true;

  // 7. General garbage check
  if (/^[^a-zA-Z0-9]+$/.test(text) || /(.)\1{3,}/.test(text)) return true;

  // 8. Project / System titles
  if (/\b(system|recommendation|project|application|app|website|platform|tool|database|api|pipeline|framework)\b/i.test(lower)) return true;

  // 9. Course qualifications
  if (/\b(msc|bsc|btech|mtech|phd|mba|degree|diploma|certificate)\b/i.test(lower)) return true;

  // 10. Properties / Buildings
  if (/\b(residency|apartment|villa|flat|tower|building|house|estate|resort)\b/i.test(lower)) return true;

  return false;
}

/**
 * Scores a single entity using a document-aware ranking formula.
 * Combines confidence, document position, frequency, and applies a header boost.
 */
function scoreEntity(entity: GLiNEREntity, docText: string): number {
  const confidence = entity.confidence;
  const text = normalizeText(entity.text);
  const lowerText = text.toLowerCase();
  const docLower = docText.toLowerCase();
  const docLength = docText.length || 1;

  // 1. Position in Document
  let startChar = entity.start;
  if (startChar === undefined || startChar < 0) {
    const idx = docLower.indexOf(lowerText);
    startChar = idx >= 0 ? idx : docLength;
  }
  const positionScore = 1 - (startChar / docLength);

  // 2. Frequency of Occurrence
  const escapedText = lowerText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const matches = docLower.match(new RegExp(escapedText, 'g'));
  const occurrences = matches ? matches.length : 0;
  const frequencyScore = Math.min(occurrences / 5, 1);

  // 3. Combine scores: confidence (0.60), position (0.25), frequency (0.15)
  // Confidence is prioritized, followed by position, then frequency.
  let rankingScore = (confidence * 0.60) + (positionScore * 0.25) + (frequencyScore * 0.15);

  // 4. Header Boost
  // Entities appearing in the first 1000 characters (e.g. document header)
  // are likely primary stakeholders (account holders, applicant name, owner).
  if (startChar < 1000) {
    rankingScore += 0.10;
  }

  // Cap score to prevent inflation beyond reasonable limits [0.0 - 1.0]
  return Math.min(rankingScore, 1.0);
}

/**
 * Normalizes, scores, ranks, and filters GLiNER entities to select stakeholders.
 */
export function extractStakeholders(
  rawEntities: GLiNEREntity[],
  docText: string
): { entities: string[]; diagnostics: StakeholderDiagnostics } {
  
  const rawTexts = Array.from(new Set(rawEntities.map(e => normalizeText(e.text))));
  const rankedMap = new Map<string, RankedEntity>();

  rawEntities.forEach(entity => {
    const text = normalizeText(entity.text);
    if (isRejected(text, entity.label)) return;

    // Filter by confidence threshold (0.60)
    if (entity.confidence < 0.60) return;

    const score = scoreEntity(entity, docText);
    const label = entity.label.toUpperCase();

    // Deduplicate: Keep the highest scoring instance
    const existing = rankedMap.get(text.toLowerCase());
    if (!existing || existing.score < score) {
      rankedMap.set(text.toLowerCase(), {
        text, // Keep original casing
        label,
        score
      });
    }
  });

  const rankedList = Array.from(rankedMap.values()).sort((a, b) => b.score - a.score);

  // Apply final selection rules
  const finalEntities: string[] = [];
  const entityScores: Record<string, number> = {};
  const entityLabels: Record<string, string> = {};

  // Track if we've added at least one PERSON and one ORGANIZATION
  let personAdded = false;
  let orgAdded = false;

  // First pass: select top Person and Org if available
  const topPerson = rankedList.find(e => e.label === 'PERSON');
  if (topPerson) {
    finalEntities.push(topPerson.text);
    personAdded = true;
  }

  const topOrg = rankedList.find(e => e.label === 'ORGANIZATION');
  if (topOrg) {
    finalEntities.push(topOrg.text);
    orgAdded = true;
  }

  // Second pass: fill up to target 3-5 entities (max 8)
  for (const item of rankedList) {
    if (finalEntities.includes(item.text)) continue;

    // Stop if we hit maximum limit
    if (finalEntities.length >= 8) break;

    // If we've reached target size (e.g. 5), only add high-scoring ones
    // Score threshold is adjusted to 0.50 reflecting the [0.0 - 1.0] scale
    if (finalEntities.length >= 5 && item.score < 0.50) break;

    finalEntities.push(item.text);
  }

  // Ensure minimum 1 entity if we have any ranked ones
  if (finalEntities.length === 0 && rankedList.length > 0) {
    finalEntities.push(rankedList[0].text);
  }

  // Populate score mapping for diagnostics
  rankedList.forEach(item => {
    entityScores[item.text] = item.score;
    entityLabels[item.text] = item.label;
  });

  const diagnostics: StakeholderDiagnostics = {
    glinerEntitiesRaw: rawTexts,
    glinerEntitiesRanked: rankedList.map(e => e.text),
    entityScores,
    entityLabels
  };

  return {
    entities: finalEntities,
    diagnostics
  };
}
