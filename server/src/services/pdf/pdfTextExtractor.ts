import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

/**
 * Extracts text from a PDF file using PyMuPDF (via Python).
 * Handles file-existence checks, execution timeouts, and safely returns
 * a typed result without throwing exceptions.
 */
export const extractPdfText = (filePath: string): Promise<PdfExtractionResult> => {
  return new Promise((resolve) => {
    const serverDir = path.resolve(__dirname, '../../..');
    let pythonPath = path.join(serverDir, 'venv/bin/python');
    if (!fs.existsSync(pythonPath)) {
      pythonPath = 'python3';
    }

    const scriptPath = path.join(__dirname, 'pdfTextExtractor.py');

    // Execute python script with a 30 second timeout limit
    execFile(pythonPath, [scriptPath, filePath], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          text: '',
          pageCount: 0,
          error: error.message || 'Python execution failed'
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          success: !!parsed.success,
          text: parsed.text || '',
          pageCount: parsed.pageCount || 0,
          error: parsed.error
        });
      } catch (e: any) {
        resolve({
          success: false,
          text: '',
          pageCount: 0,
          error: `Failed to parse extractor JSON: ${e.message}. Output was: ${stdout}`
        });
      }
    });
  });
};
