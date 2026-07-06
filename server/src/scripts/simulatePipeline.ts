import fs from 'fs';
import sharp from 'sharp';
import axios from 'axios';

async function main() {
  const originalFilePath = '/Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/uploads/1781863528279-BankStatementChequing.png';
  // Use a copy to avoid modifying the original evidence
  const testFilePath = originalFilePath + '.test_copy.png';
  fs.copyFileSync(originalFilePath, testFilePath);
  
  try {
    console.log(`Testing with copy: ${testFilePath}`);
    
    // Step 1: Check original file
    console.log('\n--- Original file info ---');
    const meta = await sharp(testFilePath).metadata();
    console.log(`Format: ${meta.format}, Size: ${meta.width}x${meta.height}`);
    console.log(`HasAlpha: ${!!meta.hasAlpha}, Channels: ${meta.channels}`);
    console.log(`File size: ${fs.statSync(testFilePath).size} bytes`);
    
    // Step 2: EXIF normalization (same as pipeline)  
    console.log('\n--- EXIF Normalization ---');
    const tempPath = `${testFilePath}.exif.tmp.jpg`;
    await sharp(testFilePath)
      .rotate()
      .withMetadata({ orientation: 1 })
      .toFile(tempPath);
    fs.renameSync(tempPath, testFilePath);
    console.log('EXIF normalization completed');
    
    const meta2 = await sharp(testFilePath).metadata();
    console.log(`After EXIF: Format: ${meta2.format}, Size: ${meta2.width}x${meta2.height}`);
    console.log(`File size: ${fs.statSync(testFilePath).size} bytes`);

    // Step 3: OCR via HTTP to the FastAPI service
    console.log('\n--- OCR via HTTP ---');
    const ocrUrl = 'http://localhost:8001';
    
    const response = await axios.post(
      `${ocrUrl}/ocr`,
      { file_path: testFilePath, language: 'en' },
      { timeout: 120000 }
    );
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify({
      text_length: response.data.text?.length || 0,
      confidence: response.data.confidence,
      error: response.data.error || 'none',
      angle: response.data.angle,
      orientationConfidence: response.data.orientationConfidence
    }));
    if (response.data.text) {
      console.log('Text preview:', response.data.text.substring(0, 200));
    }

  } finally {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  }
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
