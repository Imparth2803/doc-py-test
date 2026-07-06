import connectDB from '../config/db';
import { checkAndDecryptPDF } from '../utils/pdfDecryptor';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { extractPdfText } from '../services/pdf/pdfTextExtractor';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const checkMimeType = (filePath: string): string => {
  return "application/pdf"; // Hardcoded for this file
};

async function main() {
  const testFile = path.resolve('test_encrypted.pdf');
  const targetUploadsName = 'trace_encrypted.pdf';
  const targetUploadsPath = path.resolve(`uploads/${targetUploadsName}`);
  
  if (fs.existsSync(targetUploadsPath)) {
    fs.unlinkSync(targetUploadsPath);
  }

  // Copy encrypted test file to uploads
  fs.copyFileSync(testFile, targetUploadsPath);

  console.log('1. Decrypting PDF...');
  const decryptResult = await checkAndDecryptPDF(targetUploadsPath, {}, 'secret123');
  console.log('Decryption Result:', decryptResult);
  console.log('Decrypted File Path:', targetUploadsPath);
  console.log('File exists on disk:', fs.existsSync(targetUploadsPath));
  console.log('File size (bytes):', fs.statSync(targetUploadsPath).size);

  console.log('\n2. Attempting to parse with JS pdf-parse...');
  try {
    const pdfData = await extractPdfText(targetUploadsPath);
    if (pdfData.success) {
      console.log('pdf-parse (PyMuPDF wrapper) SUCCESS!');
      console.log('pdf-parse text length:', pdfData.text.length);
      console.log('pdf-parse page count:', pdfData.pageCount);
      console.log('pdf-parse text preview:', JSON.stringify(pdfData.text.trim()));
    } else {
      console.error('pdf-parse FAILED:', pdfData.error);
    }
  } catch (err: any) {
    console.error('pdf-parse exception:', err.message);
  }

  console.log('\n3. Attempting to extract text with Python PyMuPDF...');
  try {
    const serverDir = path.resolve(__dirname, '../..');
    let pythonPath = path.join(serverDir, 'venv/bin/python');
    if (!fs.existsSync(pythonPath)) {
      pythonPath = 'python3';
    }
    const output = execSync(`${pythonPath} -c "
import fitz
doc = fitz.open('${targetUploadsPath.replace(/\\/g, '\\\\')}')
print('Encrypted:', doc.is_encrypted)
print('Page Count:', doc.page_count)
for i, page in enumerate(doc):
    txt = page.get_text()
    print(f'Page {i} text length:', len(txt))
    print(f'Page {i} text preview:', repr(txt.strip()))
doc.close()
"`).toString().trim();
    console.log('Python PyMuPDF output:');
    console.log(output);
  } catch (err: any) {
    console.error('Python PyMuPDF FAILED:', err.message);
  }

  console.log('\n4. Checking PDF strategy decision logic...');
  const isDocEncrypted = false; // Mocked after successful decrypt
  let extractedText = "";
  try {
    const pdfData = await extractPdfText(targetUploadsPath);
    extractedText = pdfData.text.trim();
  } catch (e) {}
  
  console.log('Extracted text length for decision:', extractedText.length);
  const strategy = extractedText.length > 50 ? 'DIGITAL_DOCUMENT' : 'SCANNED_DOCUMENT';
  console.log('Decision Strategy output:', strategy);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
