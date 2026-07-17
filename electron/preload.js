const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Forwards a raw HTTP client request over the IPC channel.
   */
  apiCall: (url, options) => ipcRenderer.invoke('api-request', { url, options }),

  /**
   * Socket.io IPC Tunnel bindings
   */
  socketOn: (eventName) => ipcRenderer.send('socket-on', eventName),
  socketOff: (eventName) => ipcRenderer.send('socket-off', eventName),
  socketDisconnect: () => ipcRenderer.send('socket-disconnect'),
  
  onSocketEvent: (callback) => {
    const wrappedCallback = (event, data) => callback(event, data);
    ipcRenderer.on('socket-event', wrappedCallback);
    if (typeof window !== 'undefined') {
      if (!window._socketCallbacks) {
        window._socketCallbacks = new Map();
      }
      window._socketCallbacks.set(callback, wrappedCallback);
    }
  },

  removeSocketListener: (callback) => {
    if (typeof window !== 'undefined' && window._socketCallbacks) {
      const wrappedCallback = window._socketCallbacks.get(callback);
      if (wrappedCallback) {
        ipcRenderer.removeListener('socket-event', wrappedCallback);
        window._socketCallbacks.delete(callback);
      }
    }
  },

  /**
   * Process & Service Supervision Diagnostics API
   */
  getServiceDiagnostics: () => ipcRenderer.invoke('get-service-diagnostics'),
  restartService: (key) => ipcRenderer.invoke('restart-service', key),
  stopService: (key) => ipcRenderer.invoke('stop-service', key),
  getServiceLogs: (key) => ipcRenderer.invoke('get-service-logs', key),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppMetadata: () => ipcRenderer.invoke('get-app-metadata'),

  /**
   * Backup Manager API
   */
  createBackup: (includeUploads) => ipcRenderer.invoke('create-backup', includeUploads),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (folderName) => ipcRenderer.invoke('restore-backup', folderName),

  /**
   * Diagnostics Bundles
   */
  getDiagnosticsBundle: () => ipcRenderer.invoke('get-diagnostics-bundle')
});
