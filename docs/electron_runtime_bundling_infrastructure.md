# Phase 5A: Runtime Bundling Infrastructure

This document details the centralized runtime configurations, runtime registry, and health manager implemented in Phase 5A to support self-contained desktop deployment.

---

## 1. Centralized Runtime Configuration (`runtimeConfig.js`)

The [RuntimeConfig](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/runtimeConfig.js) module serves as the single source of truth for all dynamic path resolutions and executable pathing:

* **Mode Selection**: Dynamically toggles between `DEVELOPMENT` and `ELECTRON_DESKTOP` based on whether the app is packaged (`app.isPackaged`).
* **Path Resolution**: Provides dynamic, platform-independent (Windows vs macOS/Linux) path resolutions for:
  * Uploads directory: `<userData>/SmartDocumentVault/uploads`
  * Logs directory: `<userData>/SmartDocumentVault/logs`
  * Database directory: `<userData>/SmartDocumentVault/mongodb/data`
  * Model caches: `<userData>/SmartDocumentVault/models`
* **Local AI Model Discovery**: Exposes and injects Hugging Face (`HF_HOME`) and Tesseract (`TESSDATA_PREFIX`) cache paths into spawned environments, allowing local offline models to resolve locations automatically.
* **Backward Compatibility**: If running in standard web mode (`IS_ELECTRON !== 'true'`), standard fallback env variables are used.

---

## 2. Centralized Health Manager (`healthManager.js`)

The [HealthManager](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/healthManager.js) is responsible for all readiness polling and background status monitoring:

* **Readiness Polling**: Polls TCP sockets (for MongoDB) or HTTP GET `/health` paths (for Express and Python FastAPI servers) during startup until they respond successfully.
* **Periodic Checking**: Runs a background check loop every 5 seconds, verifying that all running services remain operational.
* **State Updates**: Updates status and health fields (`state`, `healthStatus`) directly inside the Runtime Registry.
* **History Tracking**: Retains a rolling window of the last 20 health checks for diagnostics.

---

## 3. Runtime Registry (`registry.js`)

The [RuntimeRegistry](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/registry.js) serves as the in-memory runtime database for all processes.
It monitors and aggregates metrics:
* Service Name & Type
* Process ID (PID)
* State & Uptime
* Restart Counts & Reason Logs
* Last Error Snippets
* Log File Locations

---

## 4. Structured Logging Improvements

All managers log actions using the centralized [logger.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/logger.js) utility:
* **Format**: `[Timestamp] [Level] [Component] Operation -> Result (duration: Xms)`
* **File Output**: Appended to `<userData>/SmartDocumentVault/logs/electron.log`.
* **Example Log Trace**:
  ```text
  [2026-07-16T11:00:00.123Z] [INFO] [RuntimeConfig] INITIALIZE -> Mode resolved to DEVELOPMENT
  [2026-07-16T11:00:00.456Z] [INFO] [MongoManager] START -> Spawning database at path: /usr/local/bin/mongod
  [2026-07-16T11:00:01.789Z] [INFO] [HealthManager] STARTUP_POLL -> Service "mongodb" is healthy and ready. (duration: 1332ms)
  ```
