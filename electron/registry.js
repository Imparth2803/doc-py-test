const logger = require('./logger');

class RuntimeRegistry {
  constructor() {
    this.registry = {};
  }

  /**
   * Registers a new component or microservice in the central discovery registry.
   */
  register(key, name, type, logFile = 'unknown.log') {
    this.registry[key] = {
      name,
      type, // 'database' | 'backend' | 'python_service' | etc.
      state: 'STOPPED', // 'STOPPED' | 'STARTING' | 'RUNNING' | 'CRASHED' | 'RESTARTING' | 'FAILED'
      pid: null,
      startTime: null,
      uptime: 0,
      healthStatus: 'UNHEALTHY', // 'HEALTHY' | 'UNHEALTHY'
      restartCount: 0,
      lastRestartReason: null,
      lastError: null,
      logFile,
      runtimeConfiguration: null
    };

    logger.info('RuntimeRegistry', 'REGISTER', `Registered service "${name}" [${type}]`);
  }

  /**
   * Updates state parameters for a registered service.
   */
  update(key, updates) {
    if (this.registry[key]) {
      const oldState = this.registry[key].state;
      this.registry[key] = { ...this.registry[key], ...updates };
      
      if (updates.state && updates.state !== oldState) {
        logger.info('RuntimeRegistry', 'STATE_TRANSITION', `Service "${this.registry[key].name}" transitioned: ${oldState} -> ${updates.state}`);
      }
    } else {
      logger.warn('RuntimeRegistry', `Attempted update on unregistered key "${key}"`);
    }
  }

  /**
   * Retrieves runtime configurations for a single service.
   */
  get(key) {
    return this.registry[key] || null;
  }

  /**
   * Returns the complete registry object with calculated uptime.
   */
  getAll() {
    const output = {};
    for (const key of Object.keys(this.registry)) {
      const entry = this.registry[key];
      let uptime = 0;
      if (entry.startTime && entry.state === 'RUNNING') {
        uptime = Math.floor((Date.now() - new Date(entry.startTime).getTime()) / 1000);
      }
      output[key] = {
        ...entry,
        uptime
      };
    }
    return output;
  }
}

module.exports = new RuntimeRegistry();
