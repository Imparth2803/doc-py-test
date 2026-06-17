export interface GLiNEREntities {
  persons: string[];
  organizations: string[];
  locations: string[];
}

export interface EntityComparisonResult {
  overlapCount: number;
  geminiOnlyCount: number;
  glinerOnlyCount: number;
  overlap: string[];
  geminiOnly: string[];
  glinerOnly: string[];
}

export interface GLiNERResult {
  entities: GLiNEREntities;
  latencyMs: number;
}
