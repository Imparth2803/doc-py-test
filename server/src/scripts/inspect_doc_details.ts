import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });
import connectDB from '../config/db';
import Document from '../models/Document';

async function main() {
  await connectDB();
  const docId = '6a4f3800424b3441e5e8575d';
  const doc = await Document.findById(docId).lean();
  console.log('=== COMPLETE DOCUMENT DETAIL ===');
  console.log(JSON.stringify(doc, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
