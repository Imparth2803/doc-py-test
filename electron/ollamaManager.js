const { spawn, exec } = require('child_process');
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
 * OllamaManager orchestrates the background lifecycles of the local Ollama server,
 * checks port allocations, runs health diagnostics, and imports model weights.
 */
class OllamaManager {
  constructor() {
    this.process = null;
    this.isShuttingDown = false;
    this.isReused = false;
    this.restartAttempts = 0;
  }

  /**
   * Spawns the local Ollama server process and compiles model imports.
   */
  async start() {
    this.isShuttingDown = false;
    const startTicks = Date.now();
    const settings = config.services.ollama;
    
    registry.register('ollama', settings.name, 'ollama_server', 'ollama.log');
    registry.update('ollama', { state: 'STARTING', healthStatus: 'UNHEALTHY' });

    const port = settings.defaultPort;

    // 1. Scan for Port Conflicts
    const portOccupied = await portUtility.isPortInUse(port);
    if (portOccupied) {
      logger.info('OllamaManager', 'PORT_CHECK', `Port ${port} is occupied. Querying health signature...`);
      const belongsToUs = await portUtility.checkHttpServiceHealth(
        port,
        settings.healthCheckPath,
        settings.expectedStatus
      );

      if (belongsToUs) {
        logger.info('OllamaManager', 'PORT_CHECK', `Compatible Ollama instance running on port ${port}. Reusing connection.`);
        this.isReused = true;
        registry.update('ollama', { state: 'RUNNING', healthStatus: 'HEALTHY', startTime: new Date().toISOString(), port });
        
        // Make sure Qwen model is registered locally in reused instance
        await this.ensureQwenModel();
        return true;
      } else {
        registry.update('ollama', { state: 'FAILED' });
        logger.error('OllamaManager', 'START', new Error(`Port ${port} required for Ollama is occupied by an external application.`));
        throw new Error(`Port ${port} required for Ollama is occupied by an external application.`);
      }
    }

    this.isReused = false;
    const binPath = runtimeConfig.getOllamaPath();
    const logPath = path.join(runtimeConfig.logsDir, 'ollama.log');
    
    logger.info('OllamaManager', 'START', `Spawning Ollama Server (Port: ${port})`);

    try {
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      logStream.write(`\n--- [STARTUP AT ${new Date().toISOString()}] ---\n`);

      // Spawn with serve argument
      this.process = spawn(binPath, ['serve'], {
        env: runtimeConfig.getEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.process.stdout.pipe(logStream);
      this.process.stderr.pipe(logStream);

      registry.update('ollama', { pid: this.process.pid, startTime: new Date().toISOString(), port });

      this.process.on('exit', (code, signal) => {
        logStream.end();
        this.handleExit(code, signal);
      });

      this.process.on('error', (err) => {
        logger.error('OllamaManager', 'SPAWN_ERROR', err);
        registry.update('ollama', { lastError: err.message });
      });

      // 2. Poll server health
      const maxRetries = Math.ceil(settings.policies.startupTimeoutMs / settings.policies.healthCheckIntervalMs);
      const healthy = await healthManager.pollStartup('ollama', maxRetries, settings.policies.healthCheckIntervalMs);

      if (!healthy) {
        throw new Error('Ollama Server failed to respond to health checks.');
      }

      // 3. Ensure Qwen model weights are imported
      await this.ensureQwenModel();

      logger.info('OllamaManager', 'START', 'Ollama Server successfully booted.', Date.now() - startTicks);
      registry.update('ollama', { state: 'RUNNING' });
      return true;
    } catch (error) {
      logger.error('OllamaManager', 'START', error, Date.now() - startTicks);
      registry.update('ollama', { state: 'FAILED', healthStatus: 'UNHEALTHY', lastError: error.message });
      return false;
    }
  }

  /**
   * Checks if Qwen model exists in Ollama cache and creates it offline if missing.
   */
  async ensureQwenModel() {
    const startTicks = Date.now();
    logger.info('OllamaManager', 'MODEL_CHECK', 'Verifying local Qwen model registration...');

    const binPath = runtimeConfig.getOllamaPath();
    const modelfileDir = path.join(__dirname, 'models', 'qwen');
    const modelfilePath = path.join(modelfileDir, 'Modelfile');

    if (!fs.existsSync(modelfilePath)) {
      logger.warn('OllamaManager', 'MODEL_CHECK', `Modelfile not found at: ${modelfilePath}. Skipping model check.`);
      return;
    }

    // List models to check if qwen2.5:1.5b is already registered
    return new Promise((resolve) => {
      const cmd = `"${binPath}" list`;
      const env = runtimeConfig.getEnvironment();
      
      exec(cmd, { env }, (err, stdout) => {
        if (err) {
          logger.error('OllamaManager', 'LIST_MODELS', err);
          resolve();
          return;
        }

        const modelName = 'qwen2.5:1.5b';
        const hasModel = stdout.toLowerCase().includes(modelName);

        if (hasModel) {
          logger.info('OllamaManager', 'MODEL_CHECK', 'Qwen model verified locally.');
          resolve();
        } else {
          logger.warn('OllamaManager', 'MODEL_CHECK', 'Qwen model missing from Ollama. Triggering offline creation...');
          
          // Run: ollama create qwen2.5:1.5b -f Modelfile
          const createCmd = `"${binPath}" create ${modelName} -f "${modelfilePath}"`;
          
          exec(createCmd, { env }, (createErr, createStdout, createStderr) => {
            if (createErr) {
              logger.error('OllamaManager', 'CREATE_MODEL', new Error(`Model creation failed: ${createErr.message}`));
              resolve();
              return;
            }
            logger.info('OllamaManager', 'CREATE_MODEL', 'Qwen model created successfully from GGUF weights.', Date.now() - startTicks);
            resolve();
          });
        }
      });
    });
  }

  /**
   * Handles server crashes and executes backoff restarts.
   */
  handleExit(code, signal) {
    if (this.isShuttingDown) {
      logger.info('OllamaManager', 'EXIT', 'Ollama process exited cleanly during teardown.');
      return;
    }

    logger.warn('OllamaManager', `Ollama process exited unexpectedly (code: ${code}, signal: ${signal})`);
    registry.update('ollama', { state: 'CRASHED', healthStatus: 'UNHEALTHY', pid: null });

    const settings = config.services.ollama;
    const maxAttempts = settings.policies.maxRestartAttempts;

    if (settings.policies.restartOnCrash && this.restartAttempts < maxAttempts) {
      this.restartAttempts++;
      const delay = this.restartAttempts * settings.policies.backoffDelayMs;
      registry.update('ollama', { state: 'RESTARTING', restartCount: this.restartAttempts, lastRestartReason: `Exit code ${code}` });

      logger.warn('OllamaManager', `Restarting Ollama (${this.restartAttempts}/${maxAttempts}) in ${delay}ms...`);

      setTimeout(() => {
        this.start();
      }, delay);
    } else {
      logger.error('OllamaManager', 'RESTART_FAIL', new Error('Recovery threshold exceeded for Ollama server.'));
      registry.update('ollama', { state: 'FAILED', lastError: 'Server crashed repeatedly.' });
      app.emit('ollama-failure', new Error('Ollama Server crashed repeatedly and failed to recover.'));
    }
  }

  /**
   * Shuts down the local server process cleanly.
   */
  async stop() {
    if (this.isReused) {
      logger.info('OllamaManager', 'STOP', 'Skipping: Reused instance is managed externally.');
      registry.update('ollama', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
      return;
    }

    if (!this.process) {
      registry.update('ollama', { state: 'STOPPED', healthStatus: 'UNHEALTHY' });
      return;
    }

    this.isShuttingDown = true;
    registry.update('ollama', { state: 'STOPPING' });
    logger.info('OllamaManager', 'STOP', 'Halting local Ollama server...');

    const startTicks = Date.now();
    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process) {
          logger.warn('OllamaManager', 'STOP', 'Graceful shutdown timed out. Issuing SIGKILL.');
          this.process.kill('SIGKILL');
          this.process = null;
          registry.update('ollama', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
          resolve();
        }
      }, 3000);

      this.process.once('exit', () => {
        clearTimeout(killTimeout);
        this.process = null;
        logger.info('OllamaManager', 'STOP', 'Ollama server stopped successfully.', Date.now() - startTicks);
        registry.update('ollama', { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
        resolve();
      });

      this.process.kill('SIGTERM');
    });
  }
}

module.exports = new OllamaManager();
