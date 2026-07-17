# Phase 5B: Packaging Infrastructure

This document details the production resource layout mappings, dynamic production pathing, and verification validation gates implemented in Phase 5B to make the workspace package-ready.

---

## 1. Electron Builder Mappings (`electron-builder.json`)

The packaging configuration is centralized inside [electron-builder.json](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/electron-builder.json):

* **Files Array**: Includes all scripts and source files within the `electron/` directory while excluding build caches and logs.
* **ExtraResources Array**: Maps pre-compiled workspace assets to copy them directly into the packaged application's `resources/` folder:
  * Local mongod executables from `electron/bin/` $\rightarrow$ `resources/bin/`
  * Frontend React builds from `client/dist/` $\rightarrow$ `resources/client/dist/`
  * Backend server builds from `server/dist/` $\rightarrow$ `resources/server/dist/`
  * Backend Node dependencies from `server/node_modules/` $\rightarrow$ `resources/server/node_modules/`

---

## 2. Production Runtime Pathing

Path resolutions in [runtimeConfig.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/runtimeConfig.js) are adapted for packaged mode:

* **React UI Location**: Exposes `getReactUIPath()` which points to:
  * Dev: `http://localhost:3000`
  * Packaged: `path.join(process.resourcesPath, 'client', 'dist', 'index.html')`
* **Express Backend Execution**: Exposes `getBackendEntryPoint()` which points to:
  * Dev: Runs `ts-node src/index.ts` from `../server`
  * Packaged: Runs `dist/index.js` using Node from `process.resourcesPath/server`

---

## 3. First-Run Directory Initialization

* **First Launch Hooks**: The `RuntimeConfig` constructor executes directory setup checks.
* **Idempotency**: It checks directory existence (`fs.existsSync`) before calling `fs.mkdirSync()`, ensuring that subsequent launches do not overwrite or corrupt user data files.
* **Paths Created**: `uploads/`, `logs/`, `temp/`, `cache/`, `config/`, `models/` (including Hugging Face and Tesseract cache directories), and `backups/`.

---

## 4. Resource Validation Pipeline (`buildPipeline.js`)

Before initiating the final build command, a build validator script [buildPipeline.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/buildPipeline.js) scans prerequisites:
1. **React Assets**: Verifies `client/dist/index.html` exists.
2. **Backend Code**: Verifies `server/dist/index.js` exists.
3. **Backend Packages**: Verifies `server/node_modules/` folder is present.
4. **Local database binaries**: Verifies `electron/bin/mongod` (or `mongod.exe` on Windows) is present.
5. **Python Virtual Environment**: Verifies `server/venv/` exists and contains the python binary.

The script outputs structured log checks to the console and logs them inside `electron/build.log`. If any validation check fails, it exits with error code 1, preventing corrupted packaging.

---

## 5. Application Metadata API

* Metadata properties (version, name, company description, support URL) are centralized in `runtimeConfig.js`.
* Main process exposes this block over the `'get-app-metadata'` IPC handler.
* Preload exposes the frontend retrieval method `window.electronAPI.getAppMetadata()`.
