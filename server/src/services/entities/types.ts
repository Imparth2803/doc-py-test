export interface GLiNEREntities {
  persons: string[];
  organizations: string[];
}

export interface GLiNEREntity {
  text: string;
  label: string;
  confidence: number;
  start?: number;
  end?: number;
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

export interface GLiNERSanitizationDiagnostics {
  rawCount: number;
  filteredNumbers: number;
  filteredIDs: number;
  filteredDates: number;
  filteredLowConfidence: number;
  filteredGarbage: number;
  filteredOrganizationValidation: number;
  filteredPersonValidation: number;
  finalCount: number;
}

export interface GLiNERResult {
  entities: GLiNEREntities;
  rawEntities: GLiNEREntity[];
  chunkCount: number;
  avgConfidence: number;
  latencyMs: number;
  sanitization?: GLiNERSanitizationDiagnostics;
  stakeholders?: string[];
  stakeholderDiagnostics?: any;
}
