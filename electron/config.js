const path = require('path');

module.exports = {
  // Service configuration and health policies
  services: {
    mongodb: {
      name: 'MongoDB',
      defaultPort: 27017,
      healthCheckPath: null, // Socket check only
      policies: {
        startupTimeoutMs: 15000,
        healthCheckIntervalMs: 1000,
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      }
    },
    ollama: {
      name: 'Ollama Server',
      defaultPort: 11434,
      healthCheckPath: '/api/tags',
      expectedStatus: 200,
      policies: {
        startupTimeoutMs: 20000,
        healthCheckIntervalMs: 1500,
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      }
    },
    backend: {
      name: 'Express Backend',
      defaultPort: 8000,
      healthCheckPath: '/api/documents',
      expectedStatus: 200,
      policies: {
        startupTimeoutMs: 15000,
        healthCheckIntervalMs: 1000,
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      }
    },
    ocr: {
      name: 'OCR Service',
      defaultPort: 8001,
      healthCheckPath: '/health',
      expectedJson: { status: 'healthy' },
      entryPoint: 'src.services.ocr.ocr_server:app',
      logFile: 'ocr.log',
      cwd: path.join(__dirname, '../server'),
      startupArgs: [],
      env: { PYTHONPATH: path.join(__dirname, '../server') },
      startupTimeoutMs: 15000,
      healthCheckIntervalMs: 1000,
      restartPolicy: {
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      },
      dependencies: []
    },
    gliner: {
      name: 'GLiNER Service',
      defaultPort: 8002,
      healthCheckPath: '/health',
      expectedJson: { status: 'healthy' },
      entryPoint: 'src.services.gliner.gliner_server:app',
      logFile: 'gliner.log',
      cwd: path.join(__dirname, '../server'),
      startupArgs: [],
      env: { PYTHONPATH: path.join(__dirname, '../server') },
      startupTimeoutMs: 15000,
      healthCheckIntervalMs: 1000,
      restartPolicy: {
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      },
      dependencies: []
    },
    tables: {
      name: 'Table Extraction Service',
      defaultPort: 8003,
      healthCheckPath: '/health',
      expectedJson: { status: 'healthy' },
      entryPoint: 'src.services.ocr.table_server:app',
      logFile: 'tables.log',
      cwd: path.join(__dirname, '../server'),
      startupArgs: [],
      env: { PYTHONPATH: path.join(__dirname, '../server') },
      startupTimeoutMs: 15000,
      healthCheckIntervalMs: 1000,
      restartPolicy: {
        restartOnCrash: true,
        maxRestartAttempts: 3,
        backoffDelayMs: 2000
      },
      dependencies: []
    }
  }
};
