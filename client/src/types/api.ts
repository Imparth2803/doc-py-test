export interface ApiDocument {
  _id: string;
  originalName: string;
  mimeType: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  processingStrategy?: 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';

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