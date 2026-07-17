const { app, BrowserWindow, dialog, ipcMain } = require('electron');

// ============================================================================
// CENTRALIZED GPU & HARDWARE ACCELERATION INITIALIZATION (CPU-ONLY MODE)
// ============================================================================
// Disable hardware acceleration to support execution in CPU-only VM/server environments
app.disableHardwareAcceleration();

// Append Chromium switches to bypass GPU composition/rasterization pipelines
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

console.log('[MainProcess] [CPU_ONLY_MODE] Hardware acceleration disabled.');
console.log('[MainProcess] [CPU_ONLY_MODE] GPU command-line switches applied.');
console.log('[MainProcess] [CPU_ONLY_MODE] Continuing Electron initialization...');

const path = require('path');
const fs = require('fs');
const ioClient = require('socket.io-client');
const os = require('os');

// Initialize CrashHandler first to intercept early startup issues
const crashHandler = require('./crashHandler');
crashHandler.initialize();

const config = require('./config');
const registry = require('./registry');
const portUtility = require('./portUtility');
const runtimeConfig = require('./runtimeConfig');
const healthManager = require('./healthManager');
const mongoManager = require('./mongoManager');
const ollamaManager = require('./ollamaManager');
const serviceManager = require('./serviceManager');
const backendManager = require('./backendManager');
const backupManager = require('./backupManager');
const logger = require('./logger');

let mainWindow = null;
let realSocketClient = null;

// Configure global environment variables from centralized RuntimeConfig
const runtimeEnv = runtimeConfig.getEnvironment();
for (const key of Object.keys(runtimeEnv)) {
  process.env[key] = runtimeEnv[key];
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Smart Document Vault'
  });

  const uiPath = runtimeConfig.getReactUIPath();
  const isDev = runtimeConfig.mode === 'DEVELOPMENT';
  
  if (isDev) {
    mainWindow.loadURL(uiPath);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(uiPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Main application bootloader sequence.
 */
async function bootApplication() {
  const startTicks = Date.now();
  logger.info('MainProcess', 'BOOT_APPLICATION', 'Initializing application boot sequence...');
  logger.info('MainProcess', 'CPU_ONLY_MODE', 'Hardware acceleration disabled.');
  logger.info('MainProcess', 'CPU_ONLY_MODE', 'GPU command-line switches applied.');
  logger.info('MainProcess', 'CPU_ONLY_MODE', 'Running in CPU-only mode.');
  logger.info('MainProcess', 'BOOT_APPLICATION', 'Continuing Electron initialization...');
  
  try {
    // Register microservices to the generic ServiceManager
    serviceManager.register('ocr', config.services.ocr);
    serviceManager.register('gliner', config.services.gliner);
    serviceManager.register('tables', config.services.tables);

    // Step 1: Start MongoDB
    const dbSuccess = await mongoManager.start();
    if (!dbSuccess) {
      throw new Error('Failed to establish a healthy local MongoDB database connection.');
    }

    // Step 1.2: Start Ollama Server
    const ollamaSuccess = await ollamaManager.start();
    if (!ollamaSuccess) {
      throw new Error('Failed to establish healthy local Ollama Server.');
    }

    // Step 1.5: Validate Bundled Python Virtual Environment
    try {
      runtimeConfig.validatePythonEnvironment();
    } catch (err) {
      dialog.showErrorBox(
        'Python Environment Error',
        `Bundled Python virtual environment validation failed.\n\nDetails: ${err.message}\n\nPlease ensure the application package was extracted completely.`
      );
      shutdownAndQuit();
      return;
    }

    // Step 2: Start Python Microservices (OCR, GLiNER, Tables)
    const pythonSuccess = await serviceManager.startAll();
    if (!pythonSuccess) {
      throw new Error('Failed to establish healthy Python AI microservices.');
    }

    // Step 3: Start Express Backend via BackendManager
    const backendSuccess = await backendManager.start();
    if (!backendSuccess) {
      throw new Error('Failed to establish healthy Express backend server.');
    }

    // Step 4: Initialize background health checks monitoring
    healthManager.startMonitoring(5000);

    // Step 5: Launch window
    logger.info('MainProcess', 'BOOT_APPLICATION', 'Boot sequence successful. Launching UI...', Date.now() - startTicks);
    createWindow();
  } catch (error) {
    // Forward startup crash to the centralized CrashHandler
    crashHandler.handleCrash('startup', error, 'App Boot Failure');
  }
}

/**
 * Cleanup and graceful termination routine.
 */
async function shutdownAndQuit() {
  app.isQuitting = true;
  logger.info('MainProcess', 'SHUTDOWN', 'Beginning application shutdown cleanup...');

  // Stop background health check loops
  healthManager.stopMonitoring();

  // 1. Terminate Socket Client
  if (realSocketClient) {
    realSocketClient.disconnect();
    realSocketClient = null;
  }

  // 2. Terminate Express Backend via BackendManager
  await backendManager.stop();

  // 3. Terminate Python microservices cleanly
  await serviceManager.stopAll();

  // 3.5. Terminate Ollama cleanly
  await ollamaManager.stop();

  // 4. Shut down MongoDB cleanly
  await mongoManager.stop();

  logger.info('MainProcess', 'SHUTDOWN', 'Teardown complete. Exiting.');
  app.quit();
}

// ============================================================================
// IPC BRIDGE & DIAGNOSTICS IMPLEMENTATION
// ============================================================================

/**
 * Intercepts all API calls from the React UI, forwards them to the dynamic port,
 * and relays response payloads securely.
 */
ipcMain.handle('api-request', async (event, { url, options }) => {
  const backendState = registry.get('backend');
  const backendPort = backendState ? backendState.port : null;

  if (!backendPort) {
    return { ok: false, status: 503, error: 'Express backend not ready' };
  }

  const pathPart = url.includes('/api/') ? url.substring(url.indexOf('/api/')) : url;
  const targetUrl = `http://127.0.0.1:${backendPort}${pathPart}`;

  try {
    let fetchOptions = {
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'Authorization': options.headers?.Authorization || options.headers?.authorization || ''
      }
    };

    if (options.isMultipart) {
      const fileBuffer = fs.readFileSync(options.filePath);
      const blob = new Blob([fileBuffer], { type: options.mimeType });
      const formData = new FormData();
      formData.append('file', blob, options.fileName);
      
      fetchOptions.body = formData;
      delete fetchOptions.headers['Content-Type'];
      delete fetchOptions.headers['content-type'];
    } else if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
      fetchOptions.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(targetUrl, fetchOptions);
    let data;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data
    };
  } catch (error) {
    logger.error('IPCBridge', `API Proxy: ${url}`, error);
    return {
      ok: false,
      status: 500,
      error: error.message
    };
  }
});

/**
 * Socket.io IPC Relay Bridge
 */
ipcMain.on('socket-on', (event, eventName) => {
  const backendState = registry.get('backend');
  const backendPort = backendState ? backendState.port : null;
  if (!backendPort) return;

  if (!realSocketClient) {
    logger.info('IPCBridge', 'SOCKET_CONNECT', `Connecting main process socket client to port ${backendPort}...`);
    realSocketClient = ioClient(`http://127.0.0.1:${backendPort}`);
    
    realSocketClient.on('connect', () => {
      logger.info('IPCBridge', 'SOCKET_CONNECT', 'Socket client connected to local Express server.');
    });
  }

  realSocketClient.on(eventName, (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('socket-event', { event: eventName, payload: data });
    }
  });
});

ipcMain.on('socket-off', (event, eventName) => {
  if (realSocketClient) {
    realSocketClient.off(eventName);
  }
});

ipcMain.on('socket-disconnect', () => {
  if (realSocketClient) {
    realSocketClient.disconnect();
    realSocketClient = null;
  }
});

/**
 * Service Diagnostics IPC Provider
 */
ipcMain.handle('get-service-diagnostics', () => {
  return registry.getAll();
});

/**
 * Service Control IPC Hook: Start / Stop / Restart
 */
ipcMain.handle('restart-service', async (event, key) => {
  logger.info('IPCBridge', 'SERVICE_RESTART', `Restart requested for: ${key}`);
  try {
    if (key === 'mongodb') {
      await mongoManager.stop();
      return await mongoManager.start();
    } else if (key === 'ollama') {
      await ollamaManager.stop();
      return await ollamaManager.start();
    } else if (key === 'backend') {
      return await backendManager.restart();
    } else {
      await serviceManager.stopService(key);
      return await serviceManager.startService(key);
    }
  } catch (error) {
    logger.error('IPCBridge', `SERVICE_RESTART: ${key}`, error);
    return false;
  }
});

ipcMain.handle('stop-service', async (event, key) => {
  logger.info('IPCBridge', 'SERVICE_STOP', `Stop requested for: ${key}`);
  try {
    if (key === 'mongodb') {
      await mongoManager.stop();
      return true;
    } else if (key === 'ollama') {
      await ollamaManager.stop();
      return true;
    } else if (key === 'backend') {
      await backendManager.stop();
      return true;
    } else {
      await serviceManager.stopService(key);
      return true;
    }
  } catch (error) {
    logger.error('IPCBridge', `SERVICE_STOP: ${key}`, error);
    return false;
  }
});

/**
 * Log Access IPC Provider
 */
ipcMain.handle('get-service-logs', async (event, key) => {
  let logFile = '';

  if (key === 'mongodb') {
    logFile = path.join(runtimeConfig.logsDir, 'mongodb.log');
  } else if (key === 'backend') {
    logFile = path.join(runtimeConfig.logsDir, 'backend.log');
  } else {
    const configSettings = config.services[key];
    if (configSettings) {
      logFile = path.join(runtimeConfig.logsDir, configSettings.logFile);
    }
  }

  if (logFile && fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n');
      return lines.slice(-200).join('\n');
    } catch (err) {
      return `Failed to read log: ${err.message}`;
    }
  }
  return `Log file not found: ${logFile}`;
});

/**
 * Version IPC Provider
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/**
 * Metadata IPC Provider (About System)
 */
ipcMain.handle('get-app-metadata', () => {
  const metadata = runtimeConfig.getMetadata();
  return {
    ...metadata,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      pythonVersion: '3.10.11',
      mongodbVersion: '6.0.5',
      backendVersion: metadata.version,
      platformRelease: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    }
  };
});

/**
 * Backup Manager IPC Hooks
 */
ipcMain.handle('create-backup', async (event, includeUploads) => {
  return await backupManager.createBackup(includeUploads);
});

ipcMain.handle('list-backups', () => {
  return backupManager.listBackups();
});

ipcMain.handle('restore-backup', async (event, folderName) => {
  logger.info('IPCBridge', 'RESTORE_BACKUP', `Initiating restore: ${folderName}`);
  try {
    // 1. Terminate all background services first to avoid read/write collisions
    await backendManager.stop();
    await serviceManager.stopAll();
    await ollamaManager.stop();
    await mongoManager.stop();

    // 2. Perform restoration
    const res = await backupManager.restoreBackup(folderName);

    // 3. Restart services
    await mongoManager.start();
    await ollamaManager.start();
    await serviceManager.startAll();
    await backendManager.start();

    return res;
  } catch (error) {
    logger.error('IPCBridge', 'RESTORE_BACKUP_FAIL', error);
    // Restart runtimes even on failure to ensure application recovery
    await mongoManager.start();
    await ollamaManager.start();
    await serviceManager.startAll();
    await backendManager.start();
    return { success: false, error: error.message };
  }
});

/**
 * Diagnostics Bundle IPC Hook
 */
ipcMain.handle('get-diagnostics-bundle', async () => {
  const timestamp = new Date().toISOString();
  logger.info('IPCBridge', 'GET_DIAGNOSTICS', 'Compiling diagnostics bundle...');

  const logs = {};
  if (fs.existsSync(runtimeConfig.logsDir)) {
    try {
      const files = fs.readdirSync(runtimeConfig.logsDir);
      for (const file of files) {
        const filePath = path.join(runtimeConfig.logsDir, file);
        if (file.endsWith('.log') && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          logs[file] = content.split('\n').slice(-200).join('\n');
        }
      }
    } catch {}
  }

  const crashReports = [];
  const crashDir = path.join(runtimeConfig.logsDir, 'crash-reports');
  if (fs.existsSync(crashDir)) {
    try {
      const files = fs.readdirSync(crashDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(crashDir, file), 'utf8');
          crashReports.push(JSON.parse(content));
        }
      }
    } catch {}
  }

  const bundle = {
    timestamp,
    metadata: runtimeConfig.getMetadata(),
    registry: registry.getAll(),
    healthHistory: {
      mongodb: healthManager.getHistory('mongodb'),
      ollama: healthManager.getHistory('ollama'),
      backend: healthManager.getHistory('backend'),
      ocr: healthManager.getHistory('ocr'),
      gliner: healthManager.getHistory('gliner'),
      tables: healthManager.getHistory('tables')
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      osRelease: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    },
    environment: {
      IS_ELECTRON: process.env.IS_ELECTRON,
      DB_MODE: process.env.DB_MODE,
      HF_HOME: process.env.HF_HOME,
      TESSDATA_PREFIX: process.env.TESSDATA_PREFIX
    },
    logs,
    crashReports
  };

  try {
    const bundlePath = path.join(runtimeConfig.logsDir, `diagnostics-${timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf8');
    logger.info('IPCBridge', 'GET_DIAGNOSTICS', `Diagnostics bundle saved locally: ${bundlePath}`);
  } catch {}

  return bundle;
});

// App lifecycle listener bindings
app.on('ready', bootApplication);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shutdownAndQuit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', (e) => {
  if (!app.isQuitting) {
    e.preventDefault();
    shutdownAndQuit();
  }
});

// Listener for critical database failures
app.on('mongodb-failure', (error) => {
  // Let CrashHandler compile details
  crashHandler.handleCrash('mongodb', error, 'Database Process Crash');
});

// Listener for critical Python service failures
app.on('service-failure', ({ key, error }) => {
  crashHandler.handleCrash(key, error, 'AI Microservice Process Crash');
});

// Listener for critical backend failures
app.on('backend-failure', (error) => {
  crashHandler.handleCrash('backend', error, 'Express Core Server Crash');
});

// Listener for critical Ollama server failures
app.on('ollama-failure', (error) => {
  crashHandler.handleCrash('ollama', error, 'Ollama Server Process Crash');
});
