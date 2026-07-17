import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';

dotenv.config();

// ============================================================================
// PHASE 0 & 1 & 2: DATABASE CONFIGURATION PROVIDER & ABSTRACTION
// ============================================================================

export type DatabaseMode = 'ATLAS' | 'LOCAL_MONGO' | 'BUNDLED_LOCAL';

export interface IDatabaseConfig {
  mode: DatabaseMode;
  uri: string;
  dbName: string;
  // Writable Directory Layout (Resolves to user home/appdata rather than installation folder)
  writableBaseDir: string;
  dbDataDir: string;
  uploadsDir: string;
  logsDir: string;
  tempDir: string;
}

class DatabaseConfigProvider {
  private config: IDatabaseConfig;

  constructor() {
    this.config = this.resolveConfig();
  }

  /**
   * Resolves the writable data base directory on the user's operating system.
   * Prevents database writes into the read-only application installation folders.
   */
  private getWritableBaseDir(): string {
    const isElectron = process.env.IS_ELECTRON === 'true';
    
    // In future Electron mode, resolve dynamically to standard user directories
    if (isElectron) {
      if (process.platform === 'win32') {
        return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'SmartDocumentVault');
      }
      if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'SmartDocumentVault');
      }
      return path.join(os.homedir(), '.smart-document-vault');
    }

    // Default development context (backward compatibility)
    return path.join(__dirname, '../../..');
  }

  /**
   * Evaluates environment state to produce connection options and target paths.
   */
  private resolveConfig(): IDatabaseConfig {
    const writableBaseDir = this.getWritableBaseDir();
    const isElectron = process.env.IS_ELECTRON === 'true';

    // 1. Determine active database mode.
    // By default, if MONGO_URI starts with 'mongodb+srv://', it's ATLAS.
    // Otherwise, defaults to LOCAL_MONGO. BUNDLED_LOCAL is reserved for bundled Electron environments.
    let mode: DatabaseMode = 'LOCAL_MONGO';
    const envUri = process.env.MONGO_URI || '';
    
    if (isElectron || process.env.DB_MODE === 'BUNDLED_LOCAL') {
      mode = 'BUNDLED_LOCAL';
    } else if (envUri.startsWith('mongodb+srv://') || process.env.DB_MODE === 'ATLAS') {
      mode = 'ATLAS';
    }

    // 2. Resolve database name.
    const dbName = process.env.DB_NAME || 'smart-vault';

    // 3. Resolve connection URI dynamically based on the resolved mode.
    let uri = '';
    if (mode === 'BUNDLED_LOCAL') {
      const port = process.env.LOCAL_MONGO_PORT || '27017';
      uri = `mongodb://127.0.0.1:${port}/${dbName}?serverSelectionTimeoutMS=5000`;
    } else {
      // ATLAS or standard developer LOCAL_MONGO (e.g. running docker mongod)
      uri = envUri || `mongodb://127.0.0.1:27017/${dbName}`;
    }

    return {
      mode,
      uri,
      dbName,
      writableBaseDir,
      dbDataDir: path.join(writableBaseDir, 'mongodb', 'data'),
      uploadsDir: path.join(writableBaseDir, 'uploads'),
      logsDir: path.join(writableBaseDir, 'logs'),
      tempDir: path.join(writableBaseDir, 'temp')
    };
  }

  /**
   * Public accessor for centralized database settings.
   */
  public getConfig(): IDatabaseConfig {
    return this.config;
  }
}

// Single config instance used throughout the db module.
export const databaseConfigProvider = new DatabaseConfigProvider();

// ============================================================================
// PHASE 2: DATABASE LIFECYCLE MANAGEMENT HOOKS (PLACEHOLDERS / COMMENT DESIGN)
// ============================================================================

/**
 * Startup hook. Electron will import and call this method in Phase 2/3
 * to launch the local `mongod.exe` process if BUNDLED_LOCAL mode is active.
 */
export const startBundledDatabase = async (config: IDatabaseConfig): Promise<boolean> => {
  if (config.mode !== 'BUNDLED_LOCAL') {
    console.log('[Database Startup] Skipping local process spawn: Mode is ' + config.mode);
    return true;
  }

  console.log('[Database Startup] Initializing local database setup...');
  console.log(`[Database Startup] Database Data Path: ${config.dbDataDir}`);

  // Ensure database directory exists before startup
  if (!fs.existsSync(config.dbDataDir)) {
    fs.mkdirSync(config.dbDataDir, { recursive: true });
  }

  /*
   * ==========================================================================
   * FUTURE PROCESS SPAWNING CODE (PHASE 2 IMPLEMENTATION PLACEHOLDER)
   * ==========================================================================
   * 
   * const { spawn } = require('child_process');
   * const mongodPath = path.join(__dirname, '../../bin/mongod.exe'); // Bundled binary location
   * 
   * const mongoProcess = spawn(mongodPath, [
   *   '--dbpath', config.dbDataDir,
   *   '--port', '27017',
   *   '--bind_ip', '127.0.0.1',
   *   '--logpath', path.join(config.logsDir, 'mongodb.log')
   * ], {
   *   detached: true,
   *   stdio: 'ignore'
   * });
   * 
   * // Check port status loop:
   * const isPortReachable = await pollPort(27017);
   * return isPortReachable;
   */

  console.log('[Database Startup Placeholder] Bundled mongod launch command prepared.');
  return true;
};

/**
 * Monitoring hook.
 * Will keep track of CPU/Memory or connection stability of the spawned database.
 */
export const monitorDatabaseStatus = async (): Promise<{ status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'; details?: string }> => {
  const readyState = mongoose.connection.readyState;
  switch (readyState) {
    case 1:
      return { status: 'CONNECTED' };
    case 2:
      return { status: 'CONNECTED', details: 'Connecting...' };
    default:
      return { status: 'DISCONNECTED' };
  }
};

/**
 * Graceful termination hook.
 * Electron will call this during app window closed events to kill child process handles.
 */
export const stopBundledDatabase = async (): Promise<void> => {
  console.log('[Database Termination] Terminating connection and shutting down local mongod child handles...');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  /*
   * ==========================================================================
   * FUTURE PROCESS SHUTDOWN CODE (PHASE 2 IMPLEMENTATION PLACEHOLDER)
   * ==========================================================================
   * 
   * if (mongoProcess) {
   *   mongoProcess.kill('SIGINT');
   * }
   */
  
  console.log('[Database Termination Hook] Cleaned database resources.');
};

// ============================================================================
// DATABASE CONNECTION LAYER
// ============================================================================

/**
 * Main Database Connection entrypoint.
 * Centralizes Mongoose configuration and establishes connection.
 * Bypasses direct mongoose.connect calls in index.ts and scripts.
 */
const connectDB = async () => {
  const config = databaseConfigProvider.getConfig();

  try {
    console.log(`[Database] Connecting to MongoDB in ${config.mode} mode...`);

    // Complete safety guard for Atlas URI configuration
    if (config.mode === 'ATLAS' && !config.uri) {
      throw new Error('MONGO_URI is required when database mode is ATLAS.');
    }

    // Phase 2 Startup sequence integration (does nothing in dev mode, but resolves directories)
    await startBundledDatabase(config);

    const conn = await mongoose.connect(config.uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host} (Mode: ${config.mode}, Database: ${conn.connection.name})`);

  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.warn('SERVER CONTINUING WITHOUT DATABASE CONNECTION (Features will be limited)');
  }
};

export default connectDB;