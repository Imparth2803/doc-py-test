const fs = require('fs');
const path = require('path');
const runtimeConfig = require('./runtimeConfig');
const logger = require('./logger');

/**
 * BackupManager is responsible for executing live database, configuration, and upload
 * backups in the background, writing metadata logs, and validating restore points.
 */
class BackupManager {
  constructor() {
    this.backupsDir = runtimeConfig.backupsDir;
  }

  /**
   * Helper to recursively copy directories.
   */
  copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        // Skip lock files or temp sockets to prevent copy blockages
        if (entry.name.endsWith('.lock') || entry.name.startsWith('mongod.')) {
          continue;
        }
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Performs an idempotent backup save point.
   */
  async createBackup(includeUploads = true) {
    const startTicks = Date.now();
    const timestamp = new Date().toISOString();
    const folderName = `backup-${timestamp.replace(/[:.]/g, '-')}`;
    const backupPath = path.join(this.backupsDir, folderName);

    logger.info('BackupManager', 'CREATE_BACKUP', `Initializing backup at: ${backupPath}`);

    try {
      fs.mkdirSync(backupPath, { recursive: true });

      // 1. Copy MongoDB database directory safely
      const dbDest = path.join(backupPath, 'mongodb');
      if (fs.existsSync(runtimeConfig.dbDataDir)) {
        this.copyDirSync(runtimeConfig.dbDataDir, dbDest);
        logger.info('BackupManager', 'COPY_DB', 'MongoDB data files copied successfully.');
      }

      // 2. Copy Configuration directory
      const configDest = path.join(backupPath, 'config');
      if (fs.existsSync(runtimeConfig.configDir)) {
        this.copyDirSync(runtimeConfig.configDir, configDest);
        logger.info('BackupManager', 'COPY_CONFIG', 'Config files copied successfully.');
      }

      // 3. Optionally copy uploads directory
      if (includeUploads && fs.existsSync(runtimeConfig.uploadsDir)) {
        const uploadsDest = path.join(backupPath, 'uploads');
        this.copyDirSync(runtimeConfig.uploadsDir, uploadsDest);
        logger.info('BackupManager', 'COPY_UPLOADS', 'User uploads copied successfully.');
      }

      // 4. Save metadata file
      const metadata = {
        timestamp,
        version: runtimeConfig.getMetadata().version,
        includeUploads,
        files: {
          database: fs.existsSync(dbDest),
          config: fs.existsSync(configDest),
          uploads: includeUploads && fs.existsSync(path.join(backupPath, 'uploads'))
        }
      };

      fs.writeFileSync(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf8'
      );

      logger.info('BackupManager', 'CREATE_BACKUP', 'Backup completed successfully.', Date.now() - startTicks);
      return { success: true, folderName, metadata };
    } catch (error) {
      logger.error('BackupManager', 'CREATE_BACKUP', error, Date.now() - startTicks);
      // Clean up partial directories on failure
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Validates a backup directory before executing restoration.
   */
  validateBackup(folderName) {
    const backupPath = path.join(this.backupsDir, folderName);
    const metadataPath = path.join(backupPath, 'metadata.json');

    if (!fs.existsSync(backupPath)) {
      return { valid: false, error: 'Backup folder does not exist.' };
    }
    if (!fs.existsSync(metadataPath)) {
      return { valid: false, error: 'Backup metadata.json file is missing.' };
    }

    try {
      const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      const appMeta = runtimeConfig.getMetadata();

      // Check version differences
      if (meta.version !== appMeta.version) {
        logger.warn('BackupManager', `Backup version (${meta.version}) differs from application version (${appMeta.version})`);
      }

      return { valid: true, metadata: meta };
    } catch (err) {
      return { valid: false, error: `Metadata parsing failed: ${err.message}` };
    }
  }

  /**
   * Restores a backup folder. Target services must be stopped beforehand.
   */
  async restoreBackup(folderName) {
    const startTicks = Date.now();
    const validation = this.validateBackup(folderName);
    if (!validation.valid) {
      throw new Error(`Restore validation failed: ${validation.error}`);
    }

    const backupPath = path.join(this.backupsDir, folderName);
    logger.info('BackupManager', 'RESTORE_BACKUP', `Restoring backup: ${folderName}`);

    try {
      // 1. Restore MongoDB data
      const dbSrc = path.join(backupPath, 'mongodb');
      if (fs.existsSync(dbSrc)) {
        if (fs.existsSync(runtimeConfig.dbDataDir)) {
          fs.rmSync(runtimeConfig.dbDataDir, { recursive: true, force: true });
        }
        this.copyDirSync(dbSrc, runtimeConfig.dbDataDir);
        logger.info('BackupManager', 'RESTORE_DB', 'MongoDB data restored successfully.');
      }

      // 2. Restore Configuration
      const configSrc = path.join(backupPath, 'config');
      if (fs.existsSync(configSrc)) {
        if (fs.existsSync(runtimeConfig.configDir)) {
          fs.rmSync(runtimeConfig.configDir, { recursive: true, force: true });
        }
        this.copyDirSync(configSrc, runtimeConfig.configDir);
        logger.info('BackupManager', 'RESTORE_CONFIG', 'Configuration files restored.');
      }

      // 3. Restore Uploads (if included)
      const uploadsSrc = path.join(backupPath, 'uploads');
      if (fs.existsSync(uploadsSrc)) {
        if (fs.existsSync(runtimeConfig.uploadsDir)) {
          fs.rmSync(runtimeConfig.uploadsDir, { recursive: true, force: true });
        }
        this.copyDirSync(uploadsSrc, runtimeConfig.uploadsDir);
        logger.info('BackupManager', 'RESTORE_UPLOADS', 'User uploads restored.');
      }

      logger.info('BackupManager', 'RESTORE_BACKUP', 'Restore completed successfully.', Date.now() - startTicks);
      return { success: true };
    } catch (error) {
      logger.error('BackupManager', 'RESTORE_BACKUP', error, Date.now() - startTicks);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lists all existing backups sorted by timestamp.
   */
  listBackups() {
    if (!fs.existsSync(this.backupsDir)) return [];

    try {
      return fs.readdirSync(this.backupsDir)
        .filter(name => name.startsWith('backup-') && fs.statSync(path.join(this.backupsDir, name)).isDirectory())
        .map(name => {
          const validation = this.validateBackup(name);
          return {
            folderName: name,
            valid: validation.valid,
            metadata: validation.metadata || null
          };
        })
        .sort((a, b) => b.folderName.localeCompare(a.folderName));
    } catch (err) {
      logger.error('BackupManager', 'LIST_BACKUPS', err);
      return [];
    }
  }
}

module.exports = new BackupManager();
