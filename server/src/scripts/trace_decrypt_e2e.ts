import connectDB from '../config/db';
import Document from '../models/Document';
import ProcessingJob from '../models/ProcessingJob';
import { checkAndDecryptPDF } from '../utils/pdfDecryptor';
import { addDocumentJob, getDocumentQueue } from '../queue/documentQueue';
import { processDocumentWithAI } from '../services/documentProcessingService';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { buildPreviewUrl, getFilenameFromStoragePath } from '../utils/storagePathUtils';
import { execSync } from 'child_process';
import { initializeRedis } from '../queue/redis';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const isEncrypted = (pdfPath: string): boolean => {
  try {
    const serverDir = path.resolve(__dirname, '../..');
    let pythonPath = path.join(serverDir, 'venv/bin/python');
    if (!fs.existsSync(pythonPath)) {
      pythonPath = 'python3';
    }
    const output = execSync(`${pythonPath} -c "import fitz; doc = fitz.open('${pdfPath.replace(/\\/g, '\\\\')}'); print(doc.is_encrypted); doc.close()"`).toString().trim();
    return output === 'True';
  } catch (e) {
    return false;
  }
};

async function main() {
  console.log('=== STARTING END-TO-END DECRYPTION TRACE ===');
  await connectDB();
  await initializeRedis();

  const testFile = path.resolve('test_encrypted.pdf');
  const targetUploadsName = 'trace_encrypted.pdf';
  const targetUploadsPath = path.resolve(`uploads/${targetUploadsName}`);
  
  if (fs.existsSync(targetUploadsPath)) {
    fs.unlinkSync(targetUploadsPath);
  }
  
  await Document.deleteMany({ originalName: targetUploadsName });
  await ProcessingJob.deleteMany({ originalName: targetUploadsName });

  // Copy encrypted test file to uploads
  fs.copyFileSync(testFile, targetUploadsPath);

  console.log('\n--- Phase 1: Upload (Locked State) ---');
  const document = await Document.create({
    originalName: targetUploadsName,
    storagePath: targetUploadsPath,
    mimeType: 'application/pdf',
    status: 'NEEDS_PASSWORD'
  });

  console.log(`Created Locked Document ID: ${document._id}`);
  console.log('Initial document.status:', document.status);
  console.log('Initial document.storagePath:', document.storagePath);
  console.log('Initial document.originalName:', document.originalName);
  console.log('Initial document.mimeType:', document.mimeType);

  console.log('\n--- Phase 1: Decryption ---');
  const oldStoragePath = document.storagePath;
  const existsOldBefore = fs.existsSync(oldStoragePath);
  console.log('old storagePath:', oldStoragePath);
  console.log('existsSync(old):', existsOldBefore);
  console.log('Is old file encrypted on disk?', isEncrypted(oldStoragePath));

  console.log('\nPerforming decryption with checkAndDecryptPDF...');
  const decryptResult = await checkAndDecryptPDF(oldStoragePath, {}, 'secret123');
  console.log('Decryption Result:', decryptResult);

  // Reload document / check properties
  const newStoragePath = document.storagePath;
  const existsNewAfter = fs.existsSync(newStoragePath);
  console.log('new storagePath:', newStoragePath);
  console.log('existsSync(new):', existsNewAfter);
  console.log('Is new file encrypted on disk?', isEncrypted(newStoragePath));

  console.log('\nDecryption Determination Answers:');
  console.log('1. Is a new decrypted file created?', (oldStoragePath !== newStoragePath) ? 'Yes' : 'No (overwritten in-place)');
  console.log('2. What exact path is written?', newStoragePath);
  console.log('3. Does storagePath change?', (oldStoragePath !== newStoragePath) ? 'Yes' : 'No');
  console.log('4. Is the decrypted file physically present on disk?', existsNewAfter);

  console.log('\n--- Phase 2: Queue Trigger ---');
  // Reset checkpoints as done in controller
  document.processingCheckpoint = {
    ocrCompleted: false,
    enrichmentCompleted: false,
    tablesCompleted: false,
    aiCompleted: false
  };
  document.status = 'PROCESSING';
  await document.save();

  const jobDoc = await ProcessingJob.create({
    documentId: document._id,
    status: 'PENDING',
  });

  console.log('Enqueueing BullMQ job via addDocumentJob...');
  const queueResult = await addDocumentJob(document._id.toString(), jobDoc._id.toString(), 'en');
  const queue = getDocumentQueue();
  
  console.log('Queue Name:', queue?.name);
  console.log('Job ID:', queueResult.id);
  console.log('Job Payload:', queueResult.data);
  console.log('Queue Trigger Determination: Was a BullMQ job created?', !!queueResult.id);

  console.log('\n--- Phase 4: OCR Input Verification ---');
  const fileSize = fs.statSync(document.storagePath).size;
  console.log('document.storagePath:', document.storagePath);
  console.log('existsSync(storagePath):', fs.existsSync(document.storagePath));
  console.log('File size (bytes):', fileSize);
  console.log('Is OCR reading A) encrypted file or B) decrypted file?', isEncrypted(document.storagePath) ? 'A) encrypted file' : 'B) decrypted file');

  console.log('\n--- Phase 3: Worker Execution & Pipeline Steps ---');
  console.log('Running processDocumentWithAI synchronously to capture trace logs...');
  const processedDoc = await processDocumentWithAI(document._id.toString(), 'en');

  console.log('\n--- Phase 5: Mongo Verification ---');
  console.log(JSON.stringify({
    status: processedDoc.status,
    extractedTextLength: processedDoc.extractedText?.length || 0,
    entitiesCount: processedDoc.entities?.length || 0,
    tablesCount: processedDoc.tables?.length || 0,
    documentName: processedDoc.documentName,
    storagePath: processedDoc.storagePath
  }, null, 2));

  console.log('\n--- Phase 6: Preview Verification ---');
  const filename = getFilenameFromStoragePath(processedDoc.storagePath);
  const previewUrl = buildPreviewUrl(processedDoc.storagePath);
  console.log('storagePath:', processedDoc.storagePath);
  console.log('filename extracted:', filename);
  console.log('previewUrl:', previewUrl);
  console.log('Is preview referencing A) original encrypted file or B) decrypted file?', isEncrypted(processedDoc.storagePath) ? 'A) encrypted file' : 'B) decrypted file');

  // Clean up MongoDB and upload folder
  await Document.findByIdAndDelete(document._id);
  await ProcessingJob.deleteMany({ documentId: document._id });
  if (fs.existsSync(targetUploadsPath)) {
    fs.unlinkSync(targetUploadsPath);
  }
  console.log('\n=== E2E TRACE COMPLETE ===');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
