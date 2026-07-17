const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const logger = require('./logger');

class RuntimeConfig {
  constructor() {
    this.mode = app.isPackaged ? 'ELECTRON_DESKTOP' : 'DEVELOPMENT';
    
    // Resolve dynamic writable folders under OS-specific application data folders
    this.appDataDir = path.join(app.getPath('userData'), 'SmartDocumentVault');
    this.uploadsDir = path.join(this.appDataDir, 'uploads');
    this.logsDir = path.join(this.appDataDir, 'logs');
    this.tempDir = path.join(this.appDataDir, 'temp');
    this.cacheDir = path.join(this.appDataDir, 'cache');
    this.configDir = path.join(this.appDataDir, 'config');
    this.modelsDir = path.join(this.appDataDir, 'models');
    this.dbDataDir = path.join(this.appDataDir, 'mongodb', 'data');
    this.backupsDir = path.join(this.appDataDir, 'backups');

    // Subdirectories for Hugging Face, Tesseract and Ollama model caches
    this.hfModelCacheDir = path.join(this.modelsDir, 'huggingface');
    this.tessdataDir = path.join(this.modelsDir, 'tessdata');
    this.ollamaModelsDir = path.join(this.modelsDir, 'ollama');

    // Synchronously ensure all directories exist
    this.ensureDirectories();

    // Log the configuration details
    logger.info('RuntimeConfig', 'INITIALIZE', `Mode resolved to ${this.mode}`);
    logger.info('RuntimeConfig', 'RESOLVE_PATHS', `Data Dir: ${this.appDataDir}`);
  }

  /**
   * Ensures that all required application directories are created.
   */
  ensureDirectories() {
    const dirs = [
      this.uploadsDir,
      this.logsDir,
      this.tempDir,
      this.cacheDir,
      this.configDir,
      this.modelsDir,
      this.dbDataDir,
      this.backupsDir,
      this.hfModelCacheDir,
      this.tessdataDir,
      this.ollamaModelsDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
          logger.error('RuntimeConfig', `Create dir: ${dir}`, err);
        }
      }
    }
  }

  /**
   * Resolves the correct path to the Python runtime executable from the bundled virtual environment.
   */
  getPythonExecutable() {
    const isWindows = process.platform === 'win32';
    const isDev = this.mode === 'DEVELOPMENT';
    const baseDir = isDev ? __dirname : process.resourcesPath;
    return path.join(baseDir, 'python', isWindows ? 'Scripts/python.exe' : 'bin/python');
  }

  /**
   * Alias for getPythonExecutable() to maintain backward compatibility.
   */
  getPythonPath() {
    return this.getPythonExecutable();
  }

  /**
   * Validates the bundled Python virtual environment before starting background services.
   */
  validatePythonEnvironment() {
    const start = Date.now();
    const isWindows = process.platform === 'win32';
    const pythonExec = this.getPythonExecutable();
    const pythonDir = path.dirname(isWindows ? path.dirname(pythonExec) : path.dirname(path.dirname(pythonExec)));

    const pyvenv = path.join(pythonDir, 'pyvenv.cfg');
    const libDir = isWindows ? path.join(pythonDir, 'Lib') : path.join(pythonDir, 'lib');
    
    // Resolve site-packages directory location dynamically based on platform layout
    let sitePackages = path.join(libDir, 'site-packages');
    if (!isWindows) {
      if (fs.existsSync(libDir)) {
        const subdirs = fs.readdirSync(libDir);
        for (const sub of subdirs) {
          if (sub.startsWith('python')) {
            const potential = path.join(libDir, sub, 'site-packages');
            if (fs.existsSync(potential)) {
              sitePackages = potential;
              break;
            }
          }
        }
      }
    }

    logger.info('RuntimeConfig', 'VALIDATE_PYTHON', `Checking path: ${pythonExec}`);

    if (!fs.existsSync(pythonExec)) {
      throw new Error(`Python executable not found at: ${pythonExec}`);
    }
    if (!fs.existsSync(pyvenv)) {
      throw new Error(`pyvenv.cfg virtual environment descriptor not found at: ${pyvenv}`);
    }
    if (!fs.existsSync(libDir)) {
      throw new Error(`Python library directory not found at: ${libDir}`);
    }
    if (!fs.existsSync(sitePackages)) {
      throw new Error(`site-packages directory not found at: ${sitePackages}`);
    }

    // Run execution validation check only if it's the host platform's native binary format
    const execName = path.basename(pythonExec);
    if ((process.platform === 'win32' && execName.endsWith('.exe')) || (process.platform !== 'win32' && !execName.endsWith('.exe'))) {
      const { execSync } = require('child_process');
      try {
        const output = execSync(`"${pythonExec}" --version`, { encoding: 'utf8' });
        logger.info('RuntimeConfig', 'VALIDATE_PYTHON_SUCCESS', `Python version verified: ${output.trim()}`, Date.now() - start);
      } catch (err) {
        throw new Error(`Failed to execute Python --version: ${err.message}`);
      }
    } else {
      logger.info('RuntimeConfig', 'VALIDATE_PYTHON_SUCCESS', `Skipped execution check for cross-platform binary: ${execName}`, Date.now() - start);
    }

    return true;
  }

  /**
   * Resolves the correct path to the MongoDB 'mongod' binary.
   */
  getMongodPath() {
    const start = Date.now();
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'mongod.exe' : 'mongod';

    if (this.mode === 'DEVELOPMENT') {
      const devPath = path.join(__dirname, 'bin', binaryName);
      const resolved = fs.existsSync(devPath) ? devPath : binaryName;
      logger.info('RuntimeConfig', 'RESOLVE_MONGOD', `Dev binary path: ${resolved}`, Date.now() - start);
      return resolved;
    } else {
      const packedPath = path.join(process.resourcesPath, 'bin', binaryName);
      const resolved = fs.existsSync(packedPath) ? packedPath : binaryName;
      logger.info('RuntimeConfig', 'RESOLVE_MONGOD', `Bundled binary path: ${resolved}`, Date.now() - start);
      return resolved;
    }
  }

  /**
   * Resolves the correct path to the Ollama server binary.
   */
  getOllamaPath() {
    const start = Date.now();
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'ollama.exe' : 'ollama';

    if (this.mode === 'DEVELOPMENT') {
      const devPath = path.join(__dirname, 'bin', binaryName);
      const resolved = fs.existsSync(devPath) ? devPath : binaryName;
      logger.info('RuntimeConfig', 'RESOLVE_OLLAMA', `Dev binary path: ${resolved}`, Date.now() - start);
      return resolved;
    } else {
      const packedPath = path.join(process.resourcesPath, 'bin', binaryName);
      const resolved = fs.existsSync(packedPath) ? packedPath : binaryName;
      logger.info('RuntimeConfig', 'RESOLVE_OLLAMA', `Bundled binary path: ${resolved}`, Date.now() - start);
      return resolved;
    }
  }

  /**
   * Resolves the correct node entry point path for spawning the Express backend.
   */
  getBackendEntryPoint() {
    const isDev = this.mode === 'DEVELOPMENT';
    
    if (isDev) {
      const serverDir = path.join(__dirname, '../server');
      return {
        cwd: serverDir,
        cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['ts-node', 'src/index.ts']
      };
    } else {
      const packagedServerDir = path.join(process.resourcesPath, 'server');
      return {
        cwd: packagedServerDir,
        cmd: 'node',
        args: ['dist/index.js']
      };
    }
  }

  /**
   * Resolves the location of the React UI.
   * Returns localhost dev port in DEVELOPMENT or the precompiled index.html in production.
   */
  getReactUIPath() {
    if (this.mode === 'DEVELOPMENT') {
      return 'http://localhost:3000';
    } else {
      return path.join(process.resourcesPath, 'client', 'dist', 'index.html');
    }
  }

  /**
   * Centralizes and returns application metadata.
   */
  getMetadata() {
    return {
      name: 'Smart Document Vault',
      version: app.getVersion() || '1.0.0',
      company: 'Imparth2803',
      description: 'Self-contained offline smart document locker',
      supportUrl: 'https://github.com/Imparth2803/doc-py-test',
      configVersion: '1.0'
    };
  }

  /**
   * Resolves the environmental variables to inject when spawning child processes.
   * Centralizes the paths to the local AI model directories.
   */
  getEnvironment() {
    const serverDir = path.join(__dirname, '../server');
    return {
      ...process.env,
      IS_ELECTRON: 'true',
      DB_MODE: 'BUNDLED_LOCAL',
      PYTHONPATH: serverDir,
      
      // Ollama Host & Local Model directories mapping
      OLLAMA_HOST: '127.0.0.1:11434',
      OLLAMA_MODELS: this.ollamaModelsDir,
      
      // AI Model Discovery variables
      HF_HOME: this.hfModelCacheDir,
      SENTENCE_TRANSFORMERS_HOME: this.hfModelCacheDir,
      TESSDATA_PREFIX: this.tessdataDir,
      
      // Paths for data uploads, logs, backups, and temp allocations
      UPLOADS_DIR: this.uploadsDir,
      LOGS_DIR: this.logsDir,
      TEMP_DIR: this.tempDir,
      CACHE_DIR: this.cacheDir,
      CONFIG_DIR: this.configDir,
      BACKUPS_DIR: this.backupsDir
    };
  }
}

module.exports = new RuntimeConfig();
