import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  userId?: mongoose.Types.ObjectId; // Optional for MVP until Auth is wired
  originalName: string;
  documentName?: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_SUCCESS';
  ocrConfidence?: number;
  processingStrategy?: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' | 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';
  docType?: string;
  vaultCategory?: string;
  vaultFolder?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  entities?: string[];
  tables?: {
    tableId: string;
    pageNumber: number;
    engine: string;
    confidence: number;
    rowCount: number;
    columnCount: number;
    excelPath: string;
  }[];
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingFailedAt?: Date;
  lastHeartbeatAt?: Date;
}

const DocumentSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  originalName: { type: String, required: true },
  documentName: { type: String, index: true },
  storagePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  status: { type: String, enum: ['UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS'], default: 'PROCESSING', index: true },
  ocrConfidence: { type: Number },
  processingStrategy: { type: String, enum: ['DIGITAL_DOCUMENT', 'SCANNED_DOCUMENT', 'TEXT_ONLY', 'VISION_FALLBACK', 'PENDING'], default: 'PENDING' },
  docType: { type: String },
  vaultCategory: { type: String, index: true },
  vaultFolder: { type: String, index: true },
  extractedText: { type: String },
  metadata: { type: Map, of: Schema.Types.Mixed },
  tags: [{ type: String }],
  entities: [{ type: String }],
  tables: [{
    tableId: { type: String },
    pageNumber: { type: Number },
    engine: { type: String },
    confidence: { type: Number },
    rowCount: { type: Number },
    columnCount: { type: Number },
    excelPath: { type: String }
  }],
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date },
  processingFailedAt: { type: Date },
  lastHeartbeatAt: { type: Date }
}, { timestamps: true });

// Text Index for Semantic Search prep
DocumentSchema.index(
  { originalName: 'text', documentName: 'text', extractedText: 'text', tags: 'text', docType: 'text', entities: 'text' },
  { weights: { originalName: 10, documentName: 10, docType: 5, entities: 5, tags: 5, extractedText: 1 }, name: "GlobalSearchIndex" }
);

export default mongoose.model<IDocument>('Document', DocumentSchema);