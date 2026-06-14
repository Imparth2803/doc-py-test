export interface ApiDocument {
  _id: string;
  originalName: string;
  storagePath?: string;
  documentName?: string;
  suggestedFilename?: string;
  mimeType: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  processingStrategy?: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' | 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';

  extractedText?: string;

  docType?: string;

  metadata?: Record<string, any>;

  tags?: string[];
  entities?: string[];


  confidence?: 'HIGH' | 'LOW';
  metrics?: {
    pages?: number;
    languages?: string[];
    ocrPerformed?: boolean;
    complexity?: 'HIGH' | 'LOW';
    reasoning?: string;
  };

  createdAt?: string;
  updatedAt?: string;
}