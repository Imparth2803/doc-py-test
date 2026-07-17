const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const config = require('./config');
const registry = require('./registry');
const portUtility = require('./portUtility');
const runtimeConfig = require('./runtimeConfig');
const healthManager = require('./healthManager');
const logger = require('./logger');

/**
 * BackendManager supervises the complete lifecycle (spawn, monitor, restart, shutdown)
 * of the Express core server, utilizing dynamic configurations from RuntimeConfig.
 */
class BackendManager {
  constructor() {
    const backendSettings = config.services.backend;
    this.name = backendSettings.name;
    this.port = process.env.LOCAL_BACKEND_PORT ? parseInt(process.env.LOCAL_BACKEND_PORT) : backendSettings.defaultPort;
    this.policies = backendSettings.policies;

    this.backendProcess = null;
    this.isReused = false;
    this.restartAttempts = 0;
    this.isShuttingDown = false;

    // Resolve directories exclusively from central RuntimeConfig
    this.logFile = path.join(runtimeConfig.logsDir, 'backend.log');

    // Register backend as a managed runtime component
    registry.register('backend', this.name, 'backend', 'backend.log');
    registry.update('backend', { runtimeConfiguration: backendSettings });
  }

  /**
   * Spawns the Express backend server on a dynamically resolved port.
   * Connects database and microservices discovery settings.
   */
  async start() {
    this.isShuttingDown = false;
    const startTicks = Date.now();
    registry.update('backend', { state: 'STARTING', healthStatus: 'UNHEALTHY', port: this.port });

    // 1. Scan for Port Conflicts
    const portOccupied = await portUtility.isPortInUse(this.port);
    if (portOccupied) {
      logger.info('BackendManager', 'PORT_CHECK', `Port ${this.port} is occupied. Testing process signature...`);
      const belongsToUs = await portUtility.checkHttpServiceHealth(
        this.port,
        config.services.backend.healthCheckPath,
        config.services.backend.expectedStatus
      );

      if (belongsToUs) {
        logger.info('BackendManager', 'PORT_CHECK', `Compatible Express server running on port ${this.port}. Reusing connection.`);
        this.isReused = true;
        registry.update('backend', { state: 'RUNNING', healthStatus: 'HEALTHY', startTime: new Date().toISOString() });
        return true;
      } else {
        registry.update('backend', { state: 'FAILED' });
        logger.error('BackendManager', 'START', new Error(`Port ${this.port} occupied by an external process.`));
        throw new Error(`Port ${this.port} required for Express Backend is occupied by an external process.`);
      }
    }

    this.isReused = false;
    const entry = runtimeConfig.getBackendEntryPoint();
    logger.info('BackendManager', 'START', `Spawning backend at path: ${entry.cwd} (Cmd: ${entry.cmd})`);

    // Inject dynamically resolved ports of other running components
    const mongoState = registry.get('mongodb');
    const ocrState = registry.get('ocr');
    const glinerState = registry.get('gliner');
    const tablesState = registry.get('tables');

    const env = {
      ...runtimeConfig.getEnvironment(),
      PORT: this.port.toString(),
      LOCAL_MONGO_PORT: mongoState.port ? mongoState.port.toString() : '27017',
      OCR_SERVICE_PORT: ocrState.port ? ocrState.port.toString() : '8001',
      GLINER_PORT: glinerState.port ? glinerState.port.toString() : '8002',
      TABLE_SERVICE_PORT: tablesState.port ? tablesState.port.toString() : '8003'
    };

    try {
      this.backendProcess = spawn(entry.cmd, entry.args, {
        cwd: entry.cwd,
        env,
        shell: runtimeConfig.mode === 'DEVELOPMENT'
      });

      registry.update('backend', { pid: this.backendProcess.pid, startTime: new Date().toISOString() });

      // Pipe output streams directly to log files
      const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      logStream.write(`\n--- [STARTUP AT ${new Date().toISOString()}] ---\n`);

      this.backendProcess.stdout?.pipe(logStream);
      this.backendProcess.stderr?.pipe(logStream);

      this.backendProcess.on('exit', (code, signal) => {
        logStream.end();
        this.handleExit(code, signal);
      });

      this.backendProcess.on('error', (err) => {
        logger.error('BackendManager', 'SPAWN_ERROR', err);
      });

      // 2. Delegate polling checks to the HealthManager
      const maxRetries = Math.ceil(this.policies.startupTimeoutMs / this.policies.healthCheckIntervalMs);
      const healthy = await healthManager.pollStartup('backend', maxRetries, this.policies.healthCheckIntervalMs);
      
      if (!healthy) {
        throw new Error('Express backend failed to respond to health checks.');
      }

      logger.info('BackendManager', 'START', 'Express backend successfully booted.', Date.now() - startTicks);
      this.restartAttempts = 0;
      registry.update('backend', { state: 'RUNNING' });
      return true;
    } catch (error) {
      logger.error('BackendManager', 'START', error, Date.now() - startTicks);
      registry.update('backend', { state: 'FAILED', healthStatus: 'UNHEALTHY', lastError: error.message });
      return false;
    }
  }

  /**
   * Handles unexpected exits and launches automatic crash recovery loops.
   */
  handleExit(code, signal) {
    if (this.isShuttingDown) {
      logger.info('BackendManager', 'EXIT', 'Express server process exited cleanly during teardown.');
      return;
    }

    logger.warn('BackendManager', `Process exited unexpectedly (code: ${code}, signal: ${signal})`);
    registry.update('backend', { state: 'CRASHED', healthStatus: 'UNHEALTHY', pid: null });

    if (this.policies.restartOnCrash && this.restartAttempts < this.policies.maxRestartAttempts) {
      this.restartAttempts++;
      const delay = this.restartAttempts * this.policies.backoffDelayMs;
      registry.update('backend', { state: 'RESTARTING', restartCount: this.restartAttempts, lastRestartReason: `Exit code ${code}` });
      
      logger.warn('BackendManager', `Restarting backend server (${this.restartAttempts}/${this.policies.maxRestartAttempts}) in ${delay}ms...`);
      
      setTimeout(() => {
        this.start();
      }, delay);
    } else {
      logger.error('BackendManager', 'CRASH_RECOVERY', new Error('Express backend crash recovery threshold exceeded.'));
      registry.update('backend', { state: 'FAILED', lastError: 'Express backend crashed repeatedly.' });
      app.emit('backend-failure', new Error('Express backend crashed repeatedly and could not be recovered.'));
    }
  }

  /**
   * Cleanly terminates the backend process.
   */
  async stop() {
    this.isShuttingDown = true;
    const startTicks = Date.now();
    registry.update('backend', { state: 'STOPPING' });

    if (this.isReused) {
      logger.info('BackendManager', 'STOP', 'Skipped: reusing system-wide instance.');
      registry.update('backend', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
      return;
    }

    if (!this.backendProcess) {
      registry.update('backend', { state: 'STOPPED', healthStatus: 'UNHEALTHY' });
      return;
    }

    logger.info('BackendManager', 'STOP', 'Halting server process...');

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.backendProcess) {
          logger.warn('BackendManager', 'STOP', 'Graceful shutdown timed out. Issuing SIGKILL.');
          this.backendProcess.kill('SIGKILL');
          registry.update('backend', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
          resolve();
        }
      }, 5000);

      this.backendProcess.once('exit', () => {
        clearTimeout(killTimeout);
        this.backendProcess = null;
        logger.info('BackendManager', 'STOP', 'Express backend stopped successfully.', Date.now() - startTicks);
        registry.update('backend', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
        resolve();
      });

      this.backendProcess.kill('SIGTERM');
    });
  }

  /**
   * Triggers a clean stop and start sequence.
   */
  async restart() {
    logger.info('BackendManager', 'RESTART', 'Restart requested.');
    await this.stop();
    return await this.start();
  }
}

module.exports = new BackendManager();
