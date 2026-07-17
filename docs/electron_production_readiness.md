# Phase 5C: Production Readiness & Distribution

This document details the uninstaller AppData preservation guidelines, backup/restore systems, centralized crash handling, log rotation, and IPC support interfaces implemented in Phase 5C.

---

## 1. Production Distribution & NSIS Mappings

We configured production builds inside [electron-builder.json](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/electron-builder.json) to output standard Windows NSIS installers and portable ZIP folders.
* **Installer Configuration**:
  * Allow installation directory modification.
  * Auto-generates Desktop and Start Menu shortcuts.
  * Registers standard uninstaller commands.
* **Uninstaller Data Preservation**:
  * Set `"deleteAppDataOnUninstall": false`.
  * Uninstalling the application deletes binary executable assets and temp configurations but preserves the user AppData directories by default. Database storage, uploads, logs, configuration settings, and backup directories remain intact across updates.

---

## 2. Centralized Crash Handling & Reports (`crashHandler.js`)

The [CrashHandler](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/crashHandler.js) captures uncaught exceptions, promise rejections, and critical failures.
* **Observer Hooks**: Attaches `uncaughtException` and `unhandledRejection` hooks at startup.
* **Dump Generation**: Writes structured JSON diagnostic files to `<userData>/logs/crash-reports/` containing system specs, Registry parameters, health records, error traces, and the last 50 lines of logs.
* **Fail-Safe Dialogue**: Opens a native Dialog box with crash information and terminates the process, shutting down database and microservice processes cleanly to prevent orphan processes.

---

## 3. Log Rotation

File size limits and log count shifts are managed inside [logger.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/logger.js):
* **Rotation Policy**: Log sizes are capped at 5MB, maintaining up to 5 historical backup log files (`electron.1.log`, `electron.2.log`, etc.).
* **Failsafe shift**: When the active log file size exceeds 5MB, backups are shifted and renamed, and a fresh log file is created. This runs entirely on native Node.js FS modules.

---

## 4. Backups & Restore Systems (`backupManager.js`)

The [BackupManager](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/backupManager.js) provides background data protection:
* **Background Copies**: Copies database collections (`dbDataDir`), configurations (`configDir`), and uploads (`uploadsDir`) to a timestamped folder inside `backups/` without interrupting active runtimes.
* **Validation**: Validates restoration targets by checking if `metadata.json` exists and matching app version compatibility before restoring folders.
* **Restoration Gating**: When a restore is triggered, the Main process stops all background services (Express, Python microservices, and MongoDB) to release file locks. It then copies the files and restarts all processes, returning the application to an active state.

---

## 5. System IPC Observations Bridge

Extended IPC channels are exposed via [preload.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/preload.js):

| IPC Channel | Action | Return Payload |
| :--- | :--- | :--- |
| `get-app-metadata` | Relays extended platform specs | Returns Platform, Arch, Node, Electron, Python, MongoDB, and Backend versions for the "About" systems. |
| `create-backup` | Triggers backup snapshot | Spawns backup task and outputs metadata statistics. |
| `list-backups` | Retrieves saved backup list | Scans backups directory and returns list sorted by time. |
| `restore-backup` | Safe database restore | Shuts down runtimes, copies files, and restarts services. |
| `get-diagnostics-bundle` | Compiles diagnostic state | Returns a JSON payload containing logs, crash files, health history, environment, and system states. |
