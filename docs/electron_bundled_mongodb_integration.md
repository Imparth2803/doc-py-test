# Phase 3: Embedded MongoDB Integration for Electron

This document details the design, process lifecycle, startup sequence, and configuration settings implemented to integrate local bundled MongoDB binaries under Electron control.

---

## 1. Process Lifecycle Architecture

The application delegating the database process lifecycle management entirely to the Electron main thread:

```
                  +--------------------------+
                  |  Electron Main Process   |
                  +--------------------------+
                    /                      \
                   /                        \
                  v                          v
      +------------------------+        +------------------------+
      |      MongoManager      |        |     Backend Process    |
      +------------------------+        +------------------------+
      |  - Spawns local mongod |        |  - Spawns Express API  |
      |  - TCP Socket Polling  |        |  - Health checks /     |
      |  - Crash Auto-Restarts |        |  - Port 8000 validation|
      |  - Graceful Teardown   |        +------------------------+
      +------------------------+
```

### 1.1 MongoDB Process Manager (`mongoManager.js`)
* **Binary Path Resolution**: Resolves the path to the `mongod` / `mongod.exe` binary. In development mode, it checks `electron/bin/` before falling back to system-installed global path queries. In production, it points to packaged app resources.
* **Storage Relocation**: Data files are stored inside standard OS write-accessible locations dynamically retrieved using Electron's `app.getPath('userData')` (e.g., `%LOCALAPPDATA%\SmartDocumentVault\mongodb\data` on Windows).
* **Crash Resiliency**: Listens for the `'exit'` event of the child process. If it crashes unexpectedly, `mongoManager` logs the event and attempts restart using a backoff timer up to a maximum of 3 retries. If the database remains unrecoverable, it issues a native dialog box error and shuts down backend processes.
* **Shutdown Control**: Triggers SIGINT (or SIGTERM on Windows) to let MongoDB cleanly release data write logs, close collections, and release lock files before the process terminates.

### 1.2 Startup Sequencing (`main.js`)
* Sets environmental variables `IS_ELECTRON = 'true'` and `DB_MODE = 'BUNDLED_LOCAL'`.
* Spawns MongoDB and runs TCP port connectivity checks on port `27017` to verify availability.
* Spawns Express Node server and runs HTTP requests on port `8000` to verify API accessibility.
* Once all connection check gates pass, creates the `BrowserWindow` and loads the UI (Vite dev server or static distribution files).

---

## 2. Directory Layout for Bundled Executables

To bundle the database executable:
1. Download the **MongoDB Community Server** binaries (`mongod` / `mongod.exe`) matching your target OS.
2. Put the executables inside the local project folder:
   ```
   electron/
   ├── bin/
   │   ├── mongod         <-- macOS / Linux binary
   │   └── mongod.exe     <-- Windows binary
   ├── main.js
   ├── mongoManager.js
   └── package.json
   ```
3. During packaging (via `electron-builder` configuration in later phases), configure these directories to copy into process resource paths or unpack on installation.

---

## 3. Web-Deployment Compatibility (Dev Parity)

If the application is booted as a standard web application (e.g., running `npm run dev` inside `client` and `server` folders):
* The Electron configuration flags are not loaded.
* `db.ts` resolves `MONGO_URI` using the environment variables in `.env`.
* The server skips the child-process spawn sequence (`Mode: ATLAS`), and connects to the Atlas cloud exactly as it did before, ensuring 100% backward compatibility for developers and web clients.
