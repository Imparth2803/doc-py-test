const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'build.log');

/**
 * Custom logger helper for structured build pipeline logs.
 */
function log(op, result, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] [${level}] [BuildPipeline] ${op} -> ${result}`;
  console.log(formatted);
  fs.appendFileSync(logFile, formatted + '\n', 'utf8');
}

/**
 * Validates existence of a file or folder and logs the output.
 */
function validateResource(resourceName, checkPath, isDirectory = false) {
  if (!fs.existsSync(checkPath)) {
    log(`Check ${resourceName}`, `MISSING (Path: ${checkPath})`, 'ERROR');
    return false;
  }
  
  const stats = fs.statSync(checkPath);
  if (isDirectory && !stats.isDirectory()) {
    log(`Check ${resourceName}`, `NOT A DIRECTORY (Path: ${checkPath})`, 'ERROR');
    return false;
  }
  if (!isDirectory && !stats.isFile()) {
    log(`Check ${resourceName}`, `NOT A FILE (Path: ${checkPath})`, 'ERROR');
    return false;
  }

  log(`Check ${resourceName}`, 'FOUND', 'INFO');
  return true;
}

/**
 * Verifies that all required production build resource pre-requisites are met.
 * Ensures the target Windows x64 binaries are ready for packaging.
 */
function runValidation() {
  // Clear log file
  fs.writeFileSync(logFile, '', 'utf8');
  
  log('RESOURCE_VALIDATION', 'Initializing packaging prerequisites check...');

  const rootDir = path.join(__dirname, '..');

  const checks = [
    // 1. Client production built assets
    {
      name: 'React Frontend Build',
      path: path.join(rootDir, 'client', 'dist', 'index.html'),
      isDir: false
    },
    // 2. Backend compiled Javascript entry point
    {
      name: 'Express Backend Compiled Entry',
      path: path.join(rootDir, 'server', 'dist', 'index.js'),
      isDir: false
    },
    // 3. Backend installed node modules
    {
      name: 'Express Node Modules',
      path: path.join(rootDir, 'server', 'node_modules'),
      isDir: true
    },
    // 4. Local MongoDB Windows x64 binary for bundling
    {
      name: 'Local MongoDB Windows Binary',
      path: path.join(__dirname, 'bin', 'mongod.exe'),
      isDir: false
    },
    // 5. Local Python Windows venv executable
    {
      name: 'Local Python Virtual Environment Executable',
      path: path.join(__dirname, 'python', 'Scripts', 'python.exe'),
      isDir: false
    },
    // 6. pyvenv.cfg descriptor
    {
      name: 'Local Python venv Config pyvenv.cfg',
      path: path.join(__dirname, 'python', 'pyvenv.cfg'),
      isDir: false
    },
    // 7. Lib/site-packages directory
    {
      name: 'Local Python venv site-packages Directory',
      path: path.join(__dirname, 'python', 'Lib', 'site-packages'),
      isDir: true
    },
    // 8. Local Ollama Windows Binary
    {
      name: 'Local Ollama Windows Binary',
      path: path.join(__dirname, 'bin', 'ollama.exe'),
      isDir: false
    },
    // 9. Local Qwen Modelfile descriptor
    {
      name: 'Local Qwen Modelfile',
      path: path.join(__dirname, 'models', 'qwen', 'Modelfile'),
      isDir: false
    },
    // 10. Local Qwen GGUF model weights
    {
      name: 'Local Qwen GGUF weights',
      path: path.join(__dirname, 'models', 'qwen', 'qwen2.5-1.5b.gguf'),
      isDir: false
    }
  ];

  let allValid = true;
  for (const check of checks) {
    const valid = validateResource(check.name, check.path, check.isDir);
    if (!valid) {
      allValid = false;
    }
  }

  if (allValid) {
    log('RESOURCE_VALIDATION', 'All packaging prerequisites satisfied successfully. Ready for bundling.', 'INFO');
    process.exit(0);
  } else {
    log('RESOURCE_VALIDATION', 'Prerequisite checks failed. Please compile all assets before packaging.', 'ERROR');
    process.exit(1);
  }
}

// Run the script
runValidation();
