const http = require('http');
const net = require('net');
const registry = require('./registry');
const logger = require('./logger');

class HealthManager {
  constructor() {
    this.intervalId = null;
    this.history = {}; // key -> Array of { timestamp: string, healthy: boolean }
    this.historyLimit = 20;
  }

  /**
   * Performs a single health query based on the service signature in the registry.
   */
  checkService(key) {
    return new Promise((resolve) => {
      const entry = registry.get(key);
      if (!entry || entry.state === 'STOPPED' || entry.state === 'FAILED') {
        resolve(false);
        return;
      }

      const port = entry.port;
      if (!port) {
        resolve(false);
        return;
      }

      if (entry.type === 'database') {
        // TCP Connection query for MongoDB database ports
        const socket = new net.Socket();
        socket.setTimeout(800);

        socket.connect(port, '127.0.0.1', () => {
          socket.destroy();
          this.recordHealth(key, true);
          resolve(true);
        });

        socket.on('error', () => {
          socket.destroy();
          this.recordHealth(key, false);
          resolve(false);
        });

        socket.on('timeout', () => {
          socket.destroy();
          this.recordHealth(key, false);
          resolve(false);
        });
      } else {
        // HTTP Health checks for Backend Express and AI FastAPI microservices
        const path = key === 'backend' ? '/api/documents' : '/health';
        const url = `http://127.0.0.1:${port}${path}`;
        
        const req = http.get(url, (res) => {
          req.destroy();
          const healthy = res.statusCode === 200;
          this.recordHealth(key, healthy);
          resolve(healthy);
        });

        req.setTimeout(800);

        req.on('error', () => {
          req.destroy();
          this.recordHealth(key, false);
          resolve(false);
        });

        req.on('timeout', () => {
          req.destroy();
          this.recordHealth(key, false);
          resolve(false);
        });
      }
    });
  }

  /**
   * Appends health status to the local history list.
   */
  recordHealth(key, healthy) {
    if (!this.history[key]) {
      this.history[key] = [];
    }

    const state = healthy ? 'HEALTHY' : 'UNHEALTHY';
    const oldEntry = registry.get(key);

    if (oldEntry && oldEntry.healthStatus !== state) {
      logger.info('HealthManager', 'HEALTH_CHANGE', `Service "${oldEntry.name}" is now ${state}`);
      registry.update(key, { healthStatus: state });
    }

    this.history[key].push({
      timestamp: new Date().toISOString(),
      healthy
    });

    if (this.history[key].length > this.historyLimit) {
      this.history[key].shift();
    }
  }

  /**
   * Polls a service periodically during startup until it becomes healthy.
   */
  pollStartup(key, maxRetries, intervalMs) {
    logger.info('HealthManager', 'STARTUP_POLL', `Starting readiness checks for "${key}"...`);
    return new Promise((resolve) => {
      let attempts = 0;

      const run = async () => {
        attempts++;
        const healthy = await this.checkService(key);
        if (healthy) {
          logger.info('HealthManager', 'STARTUP_POLL', `Service "${key}" is healthy and ready.`);
          resolve(true);
        } else if (attempts >= maxRetries) {
          logger.warn('HealthManager', `Startup check for "${key}" timed out after ${attempts} attempts.`);
          resolve(false);
        } else {
          setTimeout(run, intervalMs);
        }
      };

      run();
    });
  }

  /**
   * Initializes background health checks on a regular ticker.
   */
  startMonitoring(intervalMs = 5000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    logger.info('HealthManager', 'MONITORING', `Starting background health loops (interval: ${intervalMs}ms)`);
    
    this.intervalId = setInterval(async () => {
      const keys = Object.keys(registry.getAll());
      for (const key of keys) {
        const entry = registry.get(key);
        if (entry && entry.state === 'RUNNING') {
          await this.checkService(key);
        }
      }
    }, intervalMs);
  }

  /**
   * Halts background health checks.
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('HealthManager', 'MONITORING', 'Background health checks stopped.');
    }
  }

  /**
   * Returns whether all registered services are healthy and running.
   */
  isAppReady() {
    const services = registry.getAll();
    const keys = Object.keys(services);
    
    if (keys.length === 0) return false;

    return keys.every(key => {
      const entry = services[key];
      return entry.state === 'RUNNING' && entry.healthStatus === 'HEALTHY';
    });
  }

  /**
   * Retrieves the health history logs.
   */
  getHistory(key) {
    return this.history[key] || [];
  }
}

module.exports = new HealthManager();
