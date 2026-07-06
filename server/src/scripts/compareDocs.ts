import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
import connectDB from '../config/db';
import Document from '../models/Document';
import fs from 'fs';
import sharp from 'sharp';

async function main() {
  await connectDB();

  const failingId = '6a3514680ee732541144e369';
  const workingId = '6a34ed8c7d2ce73757a1a0b8'; // Bank statement with 1119 chars

  for (const docId of [failingId, workingId]) {
    const doc = await Document.findById(docId).lean();
    if (!doc) { console.log(`${docId}: not found`); continue; }

    console.log(`\n======== ${docId} ========`);
    console.log(`name: ${doc.originalName}`);
    console.log(`mimeType: ${doc.mimeType}`);
    
    if (doc.storagePath) {
      const absPath = path.isAbsolute(doc.storagePath) ? doc.storagePath : path.join(process.cwd(), doc.storagePath);
      console.log(`storagePath: ${absPath}`);
      const exists = fs.existsSync(absPath);
      console.log(`fileExists: ${exists}`);
      if (exists) {
        const stat = fs.statSync(absPath);
        console.log(`fileSize: ${stat.size} bytes`);
        const meta = await sharp(absPath).metadata();
        console.log(`dimensions: ${meta.width}x${meta.height}`);
        console.log(`format: ${meta.format}`);
        console.log(`channels: ${meta.channels}`);
        console.log(`hasAlpha: ${!!meta.hasAlpha}`);
      }
    }

    // Check if OCR checkpoint exists
    console.log(`checkpoint: ${JSON.stringify(doc.processingCheckpoint)}`);
    console.log(`ocrConfidence: ${doc.ocrConfidence}`);
    console.log(`extractedTextLength: ${doc.extractedText?.length || 0}`);
    console.log(`processingStrategy: ${doc.processingStrategy}`);
    console.log(`ocrAngle: ${doc.ocrAngle}`);
    console.log(`ocrOrientationConfidence: ${doc.ocrOrientationConfidence}`);
    console.log(`status: ${doc.status}`);

    // Check metadata for processingDiagnostics
    if (doc.metadata) {
      const meta = doc.metadata as any;
      if (meta.processingDiagnostics?.ocrQuality) {
        console.log(`ocrQuality: ${JSON.stringify(meta.processingDiagnostics.ocrQuality)}`);
      }
    }
  }

  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
