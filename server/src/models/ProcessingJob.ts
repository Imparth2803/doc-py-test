import mongoose, { Schema, Document } from 'mongoose';

export interface IProcessingJob extends Document {
  documentId: mongoose.Types.ObjectId;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  errorLogs: string[];
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  lastHeartbeatAt?: Date;
}

const ProcessingJobSchema: Schema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING', index: true },
  attempts: { type: Number, default: 0 },
  errorLogs: [{ type: String }],
  startedAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date },
  errorMessage: { type: String },
  lastHeartbeatAt: { type: Date }
}, { timestamps: true });

export default mongoose.model<IProcessingJob>('ProcessingJob', ProcessingJobSchema);