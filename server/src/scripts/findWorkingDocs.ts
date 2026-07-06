import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
import connectDB from '../config/db';
import Document from '../models/Document';

async function main() {
  await connectDB();
  // Find documents with successful OCR
  const docs = await Document.find({
    ocrConfidence: { $gt: 0 },
    extractedText: { $ne: "", $exists: true }
  }).sort({ createdAt: -1 }).limit(10).lean();

  console.log(`Found ${docs.length} documents with successful OCR:`);
  for (const d of docs) {
    console.log(`\nID: ${d._id}`);
    console.log(`  name: ${d.originalName}`);
    console.log(`  textLen: ${d.extractedText?.length}`);
    console.log(`  conf: ${d.ocrConfidence}`);
    console.log(`  strategy: ${d.processingStrategy}`);
    console.log(`  mimeType: ${d.mimeType}`);
  }
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
