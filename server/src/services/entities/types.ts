export interface GLiNEREntities {
  persons: string[];
  organizations: string[];
  locations: string[];
}

export interface GLiNEREntity {
  text: string;
  label: string;
  confidence: number;
}

export interface EntityComparisonResult {
  exactOverlapCount: number;
  fuzzyOverlapCount: number;
  geminiOnlyCount: number;
  glinerOnlyCount: number;
  overlap: string[];
  geminiOnly: string[];
  glinerOnly: string[];
}

export interface GLiNERResult {
  entities: GLiNEREntities;
  rawEntities: GLiNEREntity[];
  chunkCount: number;
  avgConfidence: number;
  latencyMs: number;
}
