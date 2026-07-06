import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface DecryptionResult {
  isEncrypted: boolean;
  decrypted: boolean;
  error?: string | null;
}

/**
 * Checks if a PDF is encrypted and attempts to decrypt it using manual password or auto-unlock patterns.
 */
export function checkAndDecryptPDF(
  filePath: string,
  userProfile?: any,
  manualPassword?: string
): Promise<DecryptionResult> {
  return new Promise((resolve) => {
    // Resolve absolute path to the virtual environment's python executable
    const serverDir = path.resolve(__dirname, '../..');
    let pythonPath = path.join(serverDir, 'venv/bin/python');
    if (!fs.existsSync(pythonPath)) {
      pythonPath = 'python3'; // Fallback to system python3 if venv doesn't exist
    }

    let scriptPath = path.join(__dirname, 'pdfDecryptor.py');
    if (!fs.existsSync(scriptPath)) {
      // Try resolving relative to src
      scriptPath = path.resolve(__dirname, '../../src/utils/pdfDecryptor.py');
      if (!fs.existsSync(scriptPath)) {
        scriptPath = path.resolve(__dirname, '../src/utils/pdfDecryptor.py');
      }
    }

    const options = {
      userProfile,
      manualPassword,
    };

    const crypto = require('crypto');
    const getHash = (p: string) => {
      try {
        const fileBuffer = fs.readFileSync(p);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } catch (e) {
        return 'N/A';
      }
    };
    const beforeExists = fs.existsSync(filePath);
    const beforeSize = beforeExists ? fs.statSync(filePath).size : 0;
    const beforeHash = beforeExists ? getHash(filePath) : 'N/A';
    console.log('\n[PDF BEFORE DECRYPT]');
    console.log('Path:', filePath);
    console.log('Exists:', beforeExists);
    console.log('Size:', beforeSize);
    console.log('SHA256:', beforeHash);
    console.log('----------------------------------------\n');

    const py = spawn(pythonPath, [scriptPath, filePath, JSON.stringify(options)]);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    py.stderr.on('data', (data) => {
      stderrData += data.toString();
      process.stderr.write(data);
    });

    py.on('close', (code) => {
      const afterExists = fs.existsSync(filePath);
      const afterSize = afterExists ? fs.statSync(filePath).size : 0;
      const afterHash = afterExists ? getHash(filePath) : 'N/A';
      console.log('\n[PDF AFTER DECRYPT]');
      console.log('Path:', filePath);
      console.log('Exists:', afterExists);
      console.log('Size:', afterSize);
      console.log('SHA256:', afterHash);
      console.log('Was original file overwritten? YES');
      console.log('Old Size:', beforeSize);
      console.log('New Size:', afterSize);
      console.log('Size Difference:', afterSize - beforeSize);
      console.log('----------------------------------------\n');

      try {
        const trimmedStdout = stdoutData.trim();
        if (trimmedStdout) {
          const parsed = JSON.parse(trimmedStdout);
          resolve({
            isEncrypted: !!parsed.isEncrypted,
            decrypted: !!parsed.decrypted,
            error: parsed.error,
          });
        } else {
          resolve({
            isEncrypted: false,
            decrypted: false,
            error: stderrData.trim() || `Python process exited with code ${code}`,
          });
        }
      } catch (err: any) {
        resolve({
          isEncrypted: false,
          decrypted: false,
          error: `Failed to parse Python output: ${err.message}. Raw output: ${stdoutData}. Stderr: ${stderrData}`,
        });
      }
    });
  });
}
