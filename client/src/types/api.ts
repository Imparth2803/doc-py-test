export interface ApiDocument {
  _id: string;
  originalName: string;
  storagePath?: string;
  documentName?: string;
  // suggestedFilename is stored in metadata.suggestedFilename and mirrored to documentName — no top-level field on the API response
  mimeType: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_SUCCESS' | 'NEEDS_PASSWORD' | 'UNLOCKING' | 'UNLOCK_FAILED' | 'DECRYPTED';

  processingStrategy?: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' | 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';

  extractedText?: string;

  docType?: string;

  metadata?: Record<string, any>;

  tags?: string[];
  entities?: string[];


  // ocrConfidence: numeric 0–100 from the OCR engine, persisted as Document.ocrConfidence
  ocrConfidence?: number;
  metrics?: {
    pages?: number;
    languages?: string[];
    ocrPerformed?: boolean;
    complexity?: 'HIGH' | 'LOW';
    reasoning?: string;
  };

  createdAt?: string;
  updatedAt?: string;
  vaultFolder?: string;
  vaultCategory?: string;
  pinnedFields?: string[];
  tables?: any;
  reminderState?: {
    status: 'ACTIVE' | 'COMPLETED' | 'DISMISSED';
    completedDate?: string;
    updatedAt?: string;
  };
}