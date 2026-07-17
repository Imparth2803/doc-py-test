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
 * ServiceManager supervises the startup, shutdown, and health checks of all
 * Python-based microservices using generic configurations.
 */
class ServiceManager {
  constructor() {
    this.isShuttingDown = false;
    this.reusedServices = {};
    this.processes = {};
  }

  /**
   * Registers a microservice configuration under the generic manager.
   */
  register(key, serviceConfig) {
    this.reusedServices[key] = false;
    
    // Register the component inside the central Runtime Registry
    registry.register(key, serviceConfig.name, 'python_service', serviceConfig.logFile);
    registry.update(key, { runtimeConfiguration: serviceConfig });
  }

  /**
   * Launches all registered services sequentially based on dependency order.
   */
  async startAll() {
    this.isShuttingDown = false;
    const startTicks = Date.now();
    logger.info('ServiceManager', 'START_ALL', 'Beginning microservices boot...');

    const keys = Object.keys(registry.getAll()).filter(k => registry.get(k).type === 'python_service');
    
    // Resolve dependency order
    const resolved = [];
    const visited = {};

    const visit = (key) => {
      if (visited[key]) return;
      visited[key] = true;

      const entry = registry.get(key);
      const svcConfig = entry ? entry.runtimeConfiguration : null;
      
      if (svcConfig && svcConfig.dependencies) {
        for (const dep of svcConfig.dependencies) {
          if (keys.includes(dep)) {
            visit(dep);
          }
        }
      }
      resolved.push(key);
    };

    for (const key of keys) {
      visit(key);
    }

    // Launch each service sequentially
    for (const key of resolved) {
      const success = await this.startService(key);
      if (!success) {
        logger.error('ServiceManager', 'START_ALL', new Error(`Startup failed at service "${key}"`));
        return false;
      }
    }

    logger.info('ServiceManager', 'START_ALL', 'All microservices loaded successfully.', Date.now() - startTicks);
    return true;
  }

  /**
   * Spawns a single microservice and registers health handlers.
   */
  async startService(key) {
    const entry = registry.get(key);
    if (!entry) {
      throw new Error(`Service "${key}" is not registered.`);
    }

    const serviceConfig = entry.runtimeConfiguration;
    const startTicks = Date.now();
    registry.update(key, { state: 'STARTING', healthStatus: 'UNHEALTHY' });

    const port = process.env[`LOCAL_${key.toUpperCase()}_PORT`]
      ? parseInt(process.env[`LOCAL_${key.toUpperCase()}_PORT`])
      : serviceConfig.defaultPort;

    // 1. Scan for Port Conflicts
    const portOccupied = await portUtility.isPortInUse(port);
    if (portOccupied) {
      logger.info('ServiceManager', 'PORT_CHECK', `Port ${port} occupied. Querying health signature for ${serviceConfig.name}...`);
      const belongsToUs = await portUtility.checkHttpServiceHealth(
        port,
        serviceConfig.healthCheckPath,
        200,
        serviceConfig.expectedJson
      );

      if (belongsToUs) {
        logger.info('ServiceManager', 'PORT_CHECK', `Compatible ${serviceConfig.name} running on port ${port}. Reusing connection.`);
        this.reusedServices[key] = true;
        registry.update(key, { state: 'RUNNING', healthStatus: 'HEALTHY', startTime: new Date().toISOString(), port });
        return true;
      } else {
        registry.update(key, { state: 'FAILED' });
        logger.error('ServiceManager', 'START_SERVICE', new Error(`Port ${port} required for ${serviceConfig.name} is occupied.`));
        throw new Error(`Port ${port} required for ${serviceConfig.name} is occupied by an external process.`);
      }
    }

    this.reusedServices[key] = false;
    const pythonPath = runtimeConfig.getPythonPath();
    const serverDir = serviceConfig.cwd || path.join(__dirname, '../server');
    const logPath = path.join(runtimeConfig.logsDir, serviceConfig.logFile);

    logger.info('ServiceManager', 'START_SERVICE', `Spawning ${serviceConfig.name} (Port: ${port})`);

    const args = [
      '-m', 'uvicorn',
      serviceConfig.entryPoint,
      '--port', port.toString(),
      '--host', '127.0.0.1',
      ...(serviceConfig.startupArgs || [])
    ];

    try {
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      logStream.write(`\n--- [STARTUP AT ${new Date().toISOString()}] ---\n`);

      const child = spawn(pythonPath, args, {
        cwd: serverDir,
        env: runtimeConfig.getEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);

      this.processes[key] = child;
      registry.update(key, { pid: child.pid, startTime: new Date().toISOString(), port });

      child.on('exit', (code, signal) => {
        logStream.end();
        this.handleExit(key, code, signal);
      });

      child.on('error', (err) => {
        logger.error('ServiceManager', `SPAWN_ERROR: ${serviceConfig.name}`, err);
        registry.update(key, { lastError: err.message });
      });

      // 2. Delegate polling checks to the HealthManager
      const maxRetries = Math.ceil(serviceConfig.startupTimeoutMs / serviceConfig.healthCheckIntervalMs);
      const healthy = await healthManager.pollStartup(key, maxRetries, serviceConfig.healthCheckIntervalMs);
      
      if (!healthy) {
        throw new Error(`${serviceConfig.name} failed to respond to health checks.`);
      }

      logger.info('ServiceManager', 'START_SERVICE', `${serviceConfig.name} successfully booted.`, Date.now() - startTicks);
      registry.update(key, { state: 'RUNNING' });
      return true;
    } catch (error) {
      logger.error('ServiceManager', `START_SERVICE: ${serviceConfig.name}`, error, Date.now() - startTicks);
      registry.update(key, { state: 'FAILED', healthStatus: 'UNHEALTHY', lastError: error.message });
      return false;
    }
  }

  /**
   * Handles service exit events and manages restart loops.
   */
  handleExit(key, code, signal) {
    if (this.isShuttingDown) {
      logger.info('ServiceManager', 'EXIT', `Service "${key}" exited cleanly during teardown.`);
      return;
    }

    const entry = registry.get(key);
    const serviceConfig = entry ? entry.runtimeConfiguration : null;
    if (!serviceConfig) return;

    logger.warn('ServiceManager', `Service "${key}" exited unexpectedly (code: ${code}, signal: ${signal})`);
    registry.update(key, { state: 'CRASHED', healthStatus: 'UNHEALTHY', pid: null });

    const currentCount = entry.restartCount || 0;
    const restartPolicy = serviceConfig.restartPolicy || {};

    if (restartPolicy.restartOnCrash && currentCount < restartPolicy.maxRestartAttempts) {
      const nextCount = currentCount + 1;
      const delay = nextCount * restartPolicy.backoffDelayMs;
      registry.update(key, { state: 'RESTARTING', restartCount: nextCount, lastRestartReason: `Exit code ${code}` });
      
      logger.warn('ServiceManager', `Restarting ${serviceConfig.name} (${nextCount}/${restartPolicy.maxRestartAttempts}) in ${delay}ms...`);
      
      setTimeout(() => {
        this.startService(key);
      }, delay);
    } else {
      logger.error('ServiceManager', 'CRASH_RECOVERY', new Error(`Recovery threshold exceeded for ${serviceConfig.name}.`));
      registry.update(key, { state: 'FAILED', lastError: 'Service crashed repeatedly.' });
      app.emit('service-failure', { key, error: new Error(`${serviceConfig.name} crashed repeatedly.`) });
    }
  }

  /**
   * Stops a single microservice cleanly.
   */
  async stopService(key) {
    const child = this.processes[key];
    const entry = registry.get(key);
    const startTicks = Date.now();

    if (!child) {
      registry.update(key, { state: 'STOPPED', healthStatus: 'UNHEALTHY' });
      return;
    }

    registry.update(key, { state: 'STOPPING' });
    logger.info('ServiceManager', 'STOP_SERVICE', `Halting service "${key}"...`);

    if (this.reusedServices[key]) {
      logger.info('ServiceManager', 'STOP_SERVICE', `Skipped: reusing system-wide instance.`);
      registry.update(key, { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
      return;
    }

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.processes[key]) {
          logger.warn('ServiceManager', 'STOP_SERVICE', `Graceful shutdown timed out. Issuing SIGKILL.`);
          this.processes[key].kill('SIGKILL');
          this.processes[key] = null;
          registry.update(key, { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
          resolve();
        }
      }, 3000);

      child.once('exit', () => {
        clearTimeout(killTimeout);
        this.processes[key] = null;
        logger.info('ServiceManager', 'STOP_SERVICE', `Service "${key}" stopped successfully.`, Date.now() - startTicks);
        registry.update(key, { state: 'STOPPED', healthStatus: 'UNHEALTHY', pid: null });
        resolve();
      });

      child.kill('SIGTERM');
    });
  }

  /**
   * Shuts down all running processes.
   */
  async stopAll() {
    this.isShuttingDown = true;
    logger.info('ServiceManager', 'STOP_ALL', 'Shutting down microservices...');
    const keys = Object.keys(this.processes);
    const stopPromises = keys.map(key => this.stopService(key));
    await Promise.all(stopPromises);
    logger.info('ServiceManager', 'STOP_ALL', 'Microservices teardown complete.');
  }
}

module.exports = new ServiceManager();
