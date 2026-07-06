import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), 'server/.env') });
import connectDB from '../config/db';
import Document from '../models/Document';
import ProcessingJob from '../models/ProcessingJob';
import mongoose from 'mongoose';

async function main() {
  await connectDB();

  for (const docId of ['6a3514680ee732541144e369', '6a29408fee216138be98f952']) {
    const doc = await Document.findById(docId).lean();
    if (!doc) { console.log(`\nDoc ${docId}: NOT FOUND`); continue; }

    console.log(`\n=== ${docId} ===`);
    console.log(`status: ${doc.status}`);
    console.log(`processingCheckpoint: ${JSON.stringify(doc.processingCheckpoint)}`);
    console.log(`processingStartedAt: ${doc.processingStartedAt}`);
    console.log(`processingCompletedAt: ${doc.processingCompletedAt}`);

    // Find associated processing job
    const jobs = await ProcessingJob.find({ documentId: new mongoose.Types.ObjectId(docId) }).lean();
    console.log(`Jobs found: ${jobs.length}`);
    for (const j of jobs) {
      console.log(`  Job ${j._id}: status=${j.status}, attempts=${j.attempts}, errorMessage=${j.errorMessage}, errorLogs=${JSON.stringify(j.errorLogs)}`);
    }

    // Check metadata processing diagnostics
    if (doc.metadata) {
      const meta = doc.metadata as any;
      if (meta.processingDiagnostics) {
        console.log('processingDiagnostics:', JSON.stringify(meta.processingDiagnostics, null, 2));
      }
    }
  }

  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
