const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, dialog } = require('electron');

const registry = require('./registry');
const healthManager = require('./healthManager');
const runtimeConfig = require('./runtimeConfig');
const logger = require('./logger');

/**
 * CrashHandler intercepts unhandled main thread exceptions/rejections, collects diagnostic logs,
 * writes structured JSON crash reports, and prevents silent process closures.
 */
class CrashHandler {
  constructor() {
    this.crashReportsDir = path.join(runtimeConfig.logsDir, 'crash-reports');
    
    try {
      fs.mkdirSync(this.crashReportsDir, { recursive: true });
    } catch (err) {
      console.error('[CrashHandler Init Error] Failed to create crash-reports folder:', err);
    }
  }

  /**
   * Registers global listeners for unhandled rejections and uncaught exceptions.
   */
  initialize() {
    process.on('uncaughtException', (err) => {
      this.handleCrash('main', err, 'Uncaught Exception');
    });

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      this.handleCrash('main', err, 'Unhandled Promise Rejection');
    });

    logger.info('CrashHandler', 'INITIALIZE', 'CrashHandler interceptors registered.');
  }

  /**
   * Compiles diagnostic states and logs, saves a JSON crash dump, and alerts the user.
   */
  handleCrash(component, error, reason = 'Fatal Error') {
    const timestamp = new Date().toISOString();
    const cleanTimestamp = timestamp.replace(/[:.]/g, '-');
    const reportPath = path.join(this.crashReportsDir, `crash-${cleanTimestamp}.json`);

    logger.error('CrashHandler', `INTERCEPT_${component.toUpperCase()}`, error);

    // Retrieve last 50 lines of logs if possible
    let recentLogs = [];
    const mainLogPath = path.join(runtimeConfig.logsDir, 'electron.log');
    if (fs.existsSync(mainLogPath)) {
      try {
        const content = fs.readFileSync(mainLogPath, 'utf8');
        recentLogs = content.split('\n').slice(-50);
      } catch (logErr) {
        recentLogs = [`Failed to read logs: ${logErr.message}`];
      }
    }

    const crashDump = {
      timestamp,
      reason,
      component,
      metadata: runtimeConfig.getMetadata(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        osRelease: os.release(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      },
      registry: registry.getAll(),
      health: {
        isAppReady: healthManager.isAppReady()
      },
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      recentLogs
    };

    try {
      fs.writeFileSync(reportPath, JSON.stringify(crashDump, null, 2), 'utf8');
      logger.info('CrashHandler', 'GENERATE_REPORT', `Crash dump saved to: ${reportPath}`);
    } catch (writeErr) {
      console.error('[CrashHandler Error] Failed to write crash dump:', writeErr);
    }

    // Inform user through native dialog box
    dialog.showErrorBox(
      'Application Error',
      `Smart Document Vault has encountered a fatal error and must close.\n\nComponent: ${component.toUpperCase()}\nDetails: ${error.message}\n\nA crash report has been saved to: ${reportPath}`
    );

    // Gracefully shut down downstream child processes
    // Injected manually to avoid circular dependencies
    try {
      const serviceManager = require('./serviceManager');
      const mongoManager = require('./mongoManager');
      const backendManager = require('./backendManager');
      const ollamaManager = require('./ollamaManager');

      serviceManager.stopAll().then(() => {
        return backendManager.stop();
      }).then(() => {
        return ollamaManager.stop();
      }).then(() => {
        return mongoManager.stop();
      }).then(() => {
        app.exit(1);
      }).catch(() => {
        app.exit(1);
      });
    } catch {
      app.exit(1);
    }
  }
}

module.exports = new CrashHandler();
