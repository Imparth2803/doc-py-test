import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
import connectDB from '../config/db';
import Document from '../models/Document';

async function main() {
  await connectDB();

  // Get docs around the same time as failing doc
  const failingDoc = await Document.findById('6a3514680ee732541144e369').lean();
  const targetTime = failingDoc?.processingCompletedAt || failingDoc?.createdAt;
  console.log(`Failing doc processed at: ${targetTime}`);
  console.log(`Failing doc _id timestamp: ${new Date(parseInt('6a351468', 16) * 1000)}`);

  // Get the working bank-statement webp
  const webpDoc = await Document.findById('6a3526810a56ae620056a20a').lean();
  console.log(`\nWorking bank-statement (webp):`);
  console.log(`  createdAt: ${webpDoc?.createdAt}`);
  console.log(`  processingCompletedAt: ${webpDoc?.processingCompletedAt}`);
  console.log(`  _id timestamp: ${new Date(parseInt(webpDoc!._id!.toString().slice(0, 8), 16) * 1000)}`);

  // Search for docs with OCR failures
  const emptyOcrDocs = await Document.find({
    extractedText: { $in: ["", null] },
    ocrConfidence: { $in: [0, null] },
    processingCheckpoint: { $ne: null }
  }).sort({ createdAt: -1 }).limit(10).lean();

  console.log(`\n${emptyOcrDocs.length} additional docs with empty OCR and checkpoints:`);
  for (const d of emptyOcrDocs) {
    if (d._id!.toString() === '6a3514680ee732541144e369') continue;
    console.log(`  ${d._id}: ${d.originalName}, mime=${d.mimeType}, strategy=${d.processingStrategy}, checkpoint=${JSON.stringify(d.processingCheckpoint)}, completedAt=${d.processingCompletedAt}`);
  }

  // Look at recent successfully OCR'd images (not PDFs)
  const recentImageDocs = await Document.find({
    mimeType: { $regex: /^image\// },
    extractedText: { $ne: "", $exists: true },
    ocrConfidence: { $gt: 0 }
  }).sort({ createdAt: -1 }).limit(5).lean();

  console.log(`\nRecent SUCCESSFUL image OCRs:`);
  for (const d of recentImageDocs) {
    console.log(`  ${d._id}: ${d.originalName}, textLen=${d.extractedText?.length}, conf=${d.ocrConfidence}, strategy=${d.processingStrategy}, completedAt=${d.processingCompletedAt}`);
  }

  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
