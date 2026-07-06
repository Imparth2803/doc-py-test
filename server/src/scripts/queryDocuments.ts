import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
import connectDB from '../config/db';
import Document from '../models/Document';
import fs from 'fs';
import sharp from 'sharp';

async function main() {
  await connectDB();

  for (const docId of ['6a3514680ee732541144e369', '6a29408fee216138be98f952']) {
    const doc = await Document.findById(docId).lean();
    if (!doc) {
      console.log(`\n=== Document ${docId} ===`);
      console.log('NOT FOUND IN DATABASE');
      continue;
    }

    console.log(`\n=== Document ${docId} ===`);
    console.log('originalName:', doc.originalName);
    console.log('storagePath:', doc.storagePath);
    console.log('mimeType:', doc.mimeType);
    console.log('status:', doc.status);
    console.log('extractedTextLength:', doc.extractedText?.length || 0);
    console.log('ocrConfidence:', doc.ocrConfidence);
    console.log('processingStrategy:', doc.processingStrategy);
    console.log('ocrAngle:', doc.ocrAngle);
    console.log('ocrOrientationConfidence:', doc.ocrOrientationConfidence);
    console.log('processingCheckpoint:', JSON.stringify(doc.processingCheckpoint));

    // File verification
    if (doc.storagePath) {
      const absPath = path.isAbsolute(doc.storagePath)
        ? doc.storagePath
        : path.join(process.cwd(), doc.storagePath);
      console.log('resolvedPath:', absPath);
      const exists = fs.existsSync(absPath);
      console.log('fileExists:', exists);
      if (exists) {
        const stat = fs.statSync(absPath);
        console.log('fileSize:', stat.size);
        try {
          const meta = await sharp(absPath).metadata();
          console.log('width:', meta.width);
          console.log('height:', meta.height);
          console.log('format:', meta.format);
        } catch (e: any) {
          console.log('dimensionError:', e.message);
        }
      }
    }
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
