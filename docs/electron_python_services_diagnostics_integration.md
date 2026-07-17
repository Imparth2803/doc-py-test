# Phase 4: Generic Python Service Manager & Diagnostics Integration

This document summarizes the service manager architecture, lifecycle tracking, health polling policies, and IPC diagnostic methods implemented to let Electron supervise independent Python microservices.

---

## 1. Service Manager Architecture

The generic [ServiceManager](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/serviceManager.js) is built as a reusable, data-driven class. It encapsulates no hardcoded service names or ports. Instead, it relies on config mappings and dynamic registration hooks:

```
+-----------------------------------------------------------+
|                       ServiceManager                      |
+-----------------------------------------------------------+
  /                         |                             \
 /                          |                              \
v                           v                               v
[OCR Service]       [GLiNER Service]        [Table Extraction Service]
```

### 1.1 Service Registration Architecture
Services are registered using standard config blocks in [config.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/config.js). Adding a future AI service (such as GLiNER-v2 or a Classification service) requires registering its parameters:
```javascript
serviceManager.register('key', {
  name: 'Service Name',
  defaultPort: 8080,
  healthCheckPath: '/health',
  expectedJson: { status: 'healthy' },
  entryPoint: 'src.services.module:app',
  logFile: 'service.log',
  cwd: '/working/directory',
  env: { ... },
  startupTimeoutMs: 15000,
  healthCheckIntervalMs: 1000,
  restartPolicy: {
    restartOnCrash: true,
    maxRestartAttempts: 3,
    backoffDelayMs: 2000
  },
  dependencies: []
});
```

---

## 2. Process Lifecycle & Crash Recovery

The manager handles lifecycle state transitions for each service independently:
`STOPPED -> STARTING -> RUNNING (HEALTHY) -> RESTARTING -> FAILED`

* **Start / Stop**: Spawns processes directly from python virtual environments (`venv/`) and stops them using native SIGTERM signals (SIGKILL on timeout).
* **Port Conflict Checks**: Prior to start, `ServiceManager` scans if the target port is occupied. If it is occupied by our service, it reuses it. If occupied by an external process, it reports a port conflict error and exits.
* **Auto-Restart & Backoff**: Unexpected exits trigger restarts with linear backoff delays ($attempts \times backoffDelay$). If a service crashes 3 times consecutively, it transitions to `FAILED` and Electron shuts down backend operations.
* **Service Independence**: A crash in `gliner` triggers restarts for the GLiNER process only, keeping `ocr` and `tables` fully operational and memory-resident.

---

## 3. Logging & STDErr Routing
Stdout and stderr of each Python microservice and the Express backend are piped directly to standard log files in the AppData directory:
* `logs/ocr.log`
* `logs/gliner.log`
* `logs/tables.log`
* `logs/backend.log`
* `logs/mongodb.log`

---

## 4. IPC Diagnostic Interfaces

The React UI communicates with Electron over IPC channels exposed via [preload.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/preload.js):

| IPC Channel | Action | Return Payload / Parameters |
| :--- | :--- | :--- |
| `get-service-diagnostics` | Retrieves running statistics | Merges PID, uptime, restart counts, last restart reasons, errors, and health flags for all 5 services. |
| `restart-service` | Controls single process reboot | Triggered by service keys (`'ocr'`, `'mongodb'`, etc.). |
| `stop-service` | Shuts down child process | Terminated cleanly via SIGTERM. |
| `get-service-logs` | Retrieves real-time output | Reads and returns the last 200 lines of log files. |
| `get-app-version` | Fetches package version | Returns string version from Electron app. |
