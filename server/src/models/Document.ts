import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import path from 'path';

export interface IDocument extends MongooseDocument {
  userId?: mongoose.Types.ObjectId; // Optional for MVP until Auth is wired
  originalName: string;
  documentName?: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL_SUCCESS' | 'NEEDS_PASSWORD' | 'UNLOCKING' | 'UNLOCK_FAILED' | 'DECRYPTED';
  ocrConfidence?: number;
  ocrAngle?: number;
  ocrOrientationConfidence?: number;
  processingStrategy?: 'DIGITAL_DOCUMENT' | 'SCANNED_DOCUMENT' | 'TEXT_ONLY' | 'VISION_FALLBACK' | 'PENDING';
  docType?: string;
  vaultCategory?: string;
  vaultFolder?: string;
  extractedText?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  entities?: string[];
  pinnedFields?: string[];
  tables?: any;
  usage?: {
    aiUnits: number;
    processingRuns: number;
    calculatorVersion?: string;
    calculatedAt?: Date;
    breakdown?: {
      ocr: number;
      tables: number;
      entities: number;
      summary: number;
      filename: number;
      tags: number;
      classification: number;
    };
  };
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingFailedAt?: Date;
  lastHeartbeatAt?: Date;
  processingCheckpoint?: {
    ocrCompleted: boolean;
    enrichmentCompleted: boolean;
    tablesCompleted: boolean;
    aiCompleted: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const DocumentSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  originalName: { type: String, required: true },
  documentName: { type: String, index: true },
  storagePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  status: { type: String, enum: ['UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS', 'NEEDS_PASSWORD', 'UNLOCKING', 'UNLOCK_FAILED', 'DECRYPTED'], default: 'PROCESSING', index: true },
  pinnedFields: { type: [String], default: [] },
  ocrConfidence: { type: Number },
  ocrAngle: { type: Number },
  ocrOrientationConfidence: { type: Number },
  processingStrategy: { type: String, enum: ['DIGITAL_DOCUMENT', 'SCANNED_DOCUMENT', 'TEXT_ONLY', 'VISION_FALLBACK', 'PENDING'], default: 'PENDING' },
  docType: { type: String },
  vaultCategory: { type: String, index: true },
  vaultFolder: { type: String, index: true },
  extractedText: { type: String },
  metadata: { type: Map, of: Schema.Types.Mixed },
  tags: [{ type: String }],
  entities: [{ type: String }],
  tables: { type: Schema.Types.Mixed },
  usage: {
    aiUnits: { type: Number, default: 0 },
    processingRuns: { type: Number, default: 0 },
    calculatorVersion: { type: String, default: '1.1.0' },
    calculatedAt: { type: Date },
    breakdown: {
      ocr: { type: Number, default: 0 },
      tables: { type: Number, default: 0 },
      entities: { type: Number, default: 0 },
      summary: { type: Number, default: 0 },
      filename: { type: Number, default: 0 },
      tags: { type: Number, default: 0 },
      classification: { type: Number, default: 0 }
    }
  },
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date },
  processingFailedAt: { type: Date },
  lastHeartbeatAt: { type: Date },
  processingCheckpoint: {
    ocrCompleted: { type: Boolean, default: false },
    enrichmentCompleted: { type: Boolean, default: false },
    tablesCompleted: { type: Boolean, default: false },
    aiCompleted: { type: Boolean, default: false },
  },
}, { timestamps: true });

// Text Index for Semantic Search prep
DocumentSchema.index(
  { originalName: 'text', documentName: 'text', extractedText: 'text', tags: 'text', docType: 'text', entities: 'text' },
  { weights: { originalName: 10, documentName: 10, docType: 5, entities: 5, tags: 5, extractedText: 1 }, name: "GlobalSearchIndex" }
);

DocumentSchema.pre<IDocument>('save', async function () {
  if (this.isModified('storagePath') && this.storagePath) {
    if (!path.isAbsolute(this.storagePath)) {
      console.log(`[PATH VALIDATION] Normalizing relative storagePath to absolute path for document ID: ${this._id}`);
      const { getAbsoluteStoragePath } = require('../utils/storagePathUtils');
      this.storagePath = getAbsoluteStoragePath(this.storagePath);
    }
  }
});

export default mongoose.model<IDocument>('Document', DocumentSchema);