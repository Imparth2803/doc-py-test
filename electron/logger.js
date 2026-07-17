const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Logger coordinates structured, timestamped logs and implements automatic,
 * zero-dependency log file rotation based on file size thresholds.
 */
class Logger {
  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'SmartDocumentVault');
    this.logsDir = path.join(this.baseDir, 'logs');
    this.logFile = path.join(this.logsDir, 'electron.log');

    // Configurable Log Rotation parameters
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.maxBackupFiles = 5;
    
    // Ensure logs folder exists
    try {
      fs.mkdirSync(this.logsDir, { recursive: true });
    } catch (err) {
      console.error('[Logger Init Error] Failed to create log directory:', err);
    }
  }

  /**
   * Helper to write structured messages to standard console and log files.
   */
  log(level, component, operation, result, duration = null) {
    const timestamp = new Date().toISOString();
    const durationStr = duration !== null ? ` (duration: ${duration}ms)` : '';
    const formatted = `[${timestamp}] [${level}] [${component}] ${operation} -> ${result}${durationStr}`;

    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    try {
      // Perform log rotation checks before appending
      this.checkAndRotate(this.logFile);
      fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
    } catch (err) {
      console.error(`[Logger Error] Failed to append log to file:`, err);
    }
  }

  /**
   * Evaluates if the log file size exceeds thresholds and triggers rotations.
   */
  checkAndRotate(filePath) {
    if (!fs.existsSync(filePath)) return;

    try {
      const stats = fs.statSync(filePath);
      if (stats.size >= this.maxFileSize) {
        // Shift existing backups: log.4 -> log.5, log.3 -> log.4, etc.
        for (let i = this.maxBackupFiles - 1; i >= 1; i--) {
          const currentBackup = filePath.replace('.log', `.${i}.log`);
          const nextBackup = filePath.replace('.log', `.${i + 1}.log`);
          if (fs.existsSync(currentBackup)) {
            fs.renameSync(currentBackup, nextBackup);
          }
        }
        
        // Rename original log to backup 1
        const backup1 = filePath.replace('.log', '.1.log');
        fs.renameSync(filePath, backup1);
      }
    } catch (err) {
      console.error('[Logger Rotation Error] Failed to rotate log file:', err);
    }
  }

  info(component, operation, result, duration = null) {
    this.log('INFO', component, operation, result, duration);
  }

  warn(component, operation, result) {
    this.log('WARN', component, operation, result);
  }

  error(component, operation, error, duration = null) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.log('ERROR', component, operation, `Failed: ${errorMsg}`, duration);
  }
}

module.exports = new Logger();
