const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logFile = path.join(__dirname, 'build.log');

function log(op, result) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ManifestGenerator] ${op} -> ${result}`);
}

/**
 * Recursively calculates the total size in bytes of a folder or file.
 */
function getPathSize(targetPath) {
  if (!fs.existsSync(targetPath)) return 0;
  
  const stats = fs.statSync(targetPath);
  if (stats.isFile()) {
    return stats.size;
  }

  let totalSize = 0;
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    totalSize += getPathSize(path.join(targetPath, entry.name));
  }
  return totalSize;
}

/**
 * Calculates SHA256 hash of a file.
 */
function getSHA256(filePath) {
  if (!fs.existsSync(filePath)) return 'MISSING';
  
  try {
    const hash = crypto.createHash('sha256');
    const fileBuffer = fs.readFileSync(filePath);
    hash.update(fileBuffer);
    return hash.digest('hex');
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

/**
 * Compiles and generates a JSON manifest describing the packaged bundle state.
 */
function generateManifest() {
  log('GENERATE', 'Compiling bundle manifest files...');

  const rootDir = path.join(__dirname, '..');
  const isWindows = process.platform === 'win32';
  const mongoBinary = isWindows ? 'mongod.exe' : 'mongod';

  const mongoPath = path.join(__dirname, 'bin', 'mongod.exe'); // Always Windows executable in bundle
  const pythonPath = path.join(__dirname, 'python', 'Scripts', 'python.exe');

  // Verify and calculate sizes
  const sizes = {
    mongodbBinary: getPathSize(mongoPath),
    pythonRuntime: getPathSize(path.join(__dirname, 'python')),
    frontendDist: getPathSize(path.join(rootDir, 'client', 'dist')),
    backendDist: getPathSize(path.join(rootDir, 'server', 'dist')),
    pythonServices: getPathSize(path.join(rootDir, 'server', 'src', 'services'))
  };

  const checksums = {
    mongodExe: getSHA256(mongoPath),
    pythonExe: getSHA256(pythonPath)
  };

  const manifest = {
    appName: 'Smart Document Vault',
    appVersion: '1.0.0',
    buildTimestamp: new Date().toISOString(),
    versions: {
      electron: process.versions.electron || '31.0.0',
      node: process.versions.node || '20.0.0',
      python: '3.10.11',
      mongodb: '6.0.5'
    },
    bundledServices: [
      { name: 'OCR Service', port: 8001, entryPoint: 'src.services.ocr.ocr_server:app' },
      { name: 'GLiNER Service', port: 8002, entryPoint: 'src.services.gliner.gliner_server:app' },
      { name: 'Table Extraction Service', port: 8003, entryPoint: 'src.services.ocr.table_server:app' }
    ],
    bundledModels: [
      'urchade/gliner_small-v2.1',
      'PaddleOCR/PP-OCRv4'
    ],
    directorySizesBytes: sizes,
    executableHashesSha256: checksums,
    totalPackageSizeBytes: Object.values(sizes).reduce((acc, curr) => acc + curr, 0)
  };

  const manifestPath = path.join(__dirname, 'manifest.json');
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    log('GENERATE', `Bundle manifest successfully written to: ${manifestPath}`);
  } catch (err) {
    log('GENERATE', `Failed to write manifest: ${err.message}`, 'ERROR');
  }
}

// Execute manifest compiler
generateManifest();
