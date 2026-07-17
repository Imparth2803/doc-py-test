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
 * MongoManager coordinates the lifespan and process supervision of the MongoDB service.
 * It queries runtime configuration settings for executable locations and directories.
 */
class MongoManager {
  constructor() {
    const mongoSettings = config.services.mongodb;
    this.name = mongoSettings.name;
    this.port = process.env.LOCAL_MONGO_PORT ? parseInt(process.env.LOCAL_MONGO_PORT) : mongoSettings.defaultPort;
    this.policies = mongoSettings.policies;
    
    this.mongoProcess = null;
    this.isReused = false;
    this.restartAttempts = 0;
    this.isShuttingDown = false;

    // Retrieve parameters exclusively from Runtime Configuration
    this.dbDataDir = runtimeConfig.dbDataDir;
    this.logFile = path.join(runtimeConfig.logsDir, 'mongodb.log');
    
    // Register component dynamically inside the Runtime Registry
    registry.register('mongodb', this.name, 'database', 'mongodb.log');
    registry.update('mongodb', { runtimeConfiguration: mongoSettings });
  }

  /**
   * Starts the MongoDB process after verifying port availability.
   * Delegates health-checking and startup readiness to HealthManager.
   */
  async start() {
    this.isShuttingDown = false;
    const startTicks = Date.now();
    registry.update('mongodb', { state: 'STARTING', healthStatus: 'UNHEALTHY', port: this.port });

    // 1. Scan for Port Conflicts
    const portOccupied = await portUtility.isPortInUse(this.port);
    if (portOccupied) {
      logger.info('MongoManager', 'PORT_CHECK', `Port ${this.port} is occupied. Testing process signature...`);
      const isMongo = await portUtility.checkMongoPort(this.port);
      
      if (isMongo) {
        logger.info('MongoManager', 'PORT_CHECK', `Compatible MongoDB running on port ${this.port}. Reusing connection.`);
        this.isReused = true;
        registry.update('mongodb', { state: 'RUNNING', healthStatus: 'HEALTHY', startTime: new Date().toISOString() });
        return true;
      } else {
        registry.update('mongodb', { state: 'FAILED' });
        logger.error('MongoManager', 'START', new Error(`Port ${this.port} occupied by an external process.`));
        throw new Error(`Port ${this.port} required for MongoDB is occupied by an external process.`);
      }
    }

    this.isReused = false;
    const mongodPath = runtimeConfig.getMongodPath();
    logger.info('MongoManager', 'START', `Spawning database at path: ${mongodPath}`);

    const args = [
      '--dbpath', this.dbDataDir,
      '--port', this.port.toString(),
      '--bind_ip', '127.0.0.1',
      '--logpath', this.logFile,
      '--logappend'
    ];

    try {
      this.mongoProcess = spawn(mongodPath, args, {
        detached: false,
        stdio: 'ignore'
      });

      registry.update('mongodb', { pid: this.mongoProcess.pid, startTime: new Date().toISOString() });

      this.mongoProcess.on('exit', (code, signal) => {
        this.handleExit(code, signal);
      });

      this.mongoProcess.on('error', (err) => {
        logger.error('MongoManager', 'SPAWN_ERROR', err);
      });

      // 2. Delegate polling checks to the HealthManager
      const maxRetries = Math.ceil(this.policies.startupTimeoutMs / this.policies.healthCheckIntervalMs);
      const healthy = await healthManager.pollStartup('mongodb', maxRetries, this.policies.healthCheckIntervalMs);
      
      if (!healthy) {
        throw new Error('MongoDB failed to respond to health checks in time.');
      }

      logger.info('MongoManager', 'START', 'MongoDB database successfully booted.', Date.now() - startTicks);
      this.restartAttempts = 0;
      registry.update('mongodb', { state: 'RUNNING' });
      return true;
    } catch (error) {
      logger.error('MongoManager', 'START', error, Date.now() - startTicks);
      registry.update('mongodb', { state: 'FAILED', healthStatus: 'UNHEALTHY', lastError: error.message });
      return false;
    }
  }

  /**
   * Handles database exit events and triggers restart loops.
   */
  handleExit(code, signal) {
    if (this.isShuttingDown) {
      logger.info('MongoManager', 'EXIT', 'Database process exited cleanly during teardown.');
      return;
    }

    logger.warn('MongoManager', `Process exited unexpectedly (code: ${code}, signal: ${signal})`);
    registry.update('mongodb', { state: 'CRASHED', healthStatus: 'UNHEALTHY', pid: null });

    if (this.policies.restartOnCrash && this.restartAttempts < this.policies.maxRestartAttempts) {
      this.restartAttempts++;
      const delay = this.restartAttempts * this.policies.backoffDelayMs;
      registry.update('mongodb', { state: 'RESTARTING', restartCount: this.restartAttempts, lastRestartReason: `Exit code ${code}` });
      
      logger.warn('MongoManager', `Restarting database (${this.restartAttempts}/${this.policies.maxRestartAttempts}) in ${delay}ms...`);
      
      setTimeout(() => {
        this.start();
      }, delay);
    } else {
      logger.error('MongoManager', 'CRASH_RECOVERY', new Error('Database crash recovery threshold exceeded.'));
      registry.update('mongodb', { state: 'FAILED', lastError: 'Database crashed repeatedly.' });
      app.emit('mongodb-failure', new Error('Database crashed repeatedly and could not be recovered.'));
    }
  }

  /**
   * Terminates the database child process.
   */
  async stop() {
    this.isShuttingDown = true;
    const startTicks = Date.now();
    registry.update('mongodb', { state: 'STOPPING' });

    if (this.isReused) {
      logger.info('MongoManager', 'STOP', 'Skipped: reusing system-wide instance.');
      registry.update('mongodb', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
      return;
    }

    if (!this.mongoProcess) {
      registry.update('mongodb', { state: 'STOPPED', healthStatus: 'UNHEALTHY' });
      return;
    }

    logger.info('MongoManager', 'STOP', 'Halting database process...');

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.mongoProcess) {
          logger.warn('MongoManager', 'STOP', 'Graceful shutdown timed out. Issuing SIGKILL.');
          this.mongoProcess.kill('SIGKILL');
          registry.update('mongodb', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
          resolve();
        }
      }, 5000);

      this.mongoProcess.once('exit', () => {
        clearTimeout(killTimeout);
        this.mongoProcess = null;
        logger.info('MongoManager', 'STOP', 'MongoDB stopped successfully.', Date.now() - startTicks);
        registry.update('mongodb', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
        resolve();
      });

      if (process.platform === 'win32') {
        this.mongoProcess.kill('SIGTERM');
      } else {
        this.mongoProcess.kill('SIGINT');
      }
    });
  }
}

module.exports = new MongoManager();
