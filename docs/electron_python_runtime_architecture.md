# Bundled Python Runtime Architecture

This document describes how the application bundles and manages its private Python virtual environment, resolving interpreter paths and verifying runtimes cleanly.

---

## 1. Directory Structure

The Windows application bundles the complete Python virtual environment under the `resources/python/` folder:

```
SmartDocumentVault/
├── SmartDocumentVault.exe
└── resources/
    ├── python/
    │   ├── Scripts/
    │   │   ├── python.exe       <-- Target interpreter
    │   │   ├── pip.exe
    │   │   └── ...
    │   ├── Lib/
    │   │   └── site-packages/   <-- Preinstalled AI microservice packages
    │   ├── pyvenv.cfg           <-- Virtual environment configuration
    │   └── Include/
    ├── bin/                     <-- MongoDB bin
    └── services/                <-- Python AI services
```

---

## 2. Centralized Path Resolution (`getPythonExecutable`)

Path resolution is centralized inside [runtimeConfig.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/runtimeConfig.js) to decouple execution logic from environment configuration:

```javascript
getPythonExecutable() {
  const isWindows = process.platform === 'win32';
  const isDev = this.mode === 'DEVELOPMENT';
  const baseDir = isDev ? __dirname : process.resourcesPath;
  return path.join(baseDir, 'python', isWindows ? 'Scripts/python.exe' : 'bin/python');
}
```

* **Development Mode**: Resolves paths locally under `electron/python/Scripts/python.exe` (or `bin/python` on Mac/Linux).
* **Production Mode**: Resolves paths inside `resourcesPath/python/Scripts/python.exe` (or `bin/python` on Mac/Linux).

---

## 3. Pre-flight Validation Gates

Before starting any background FastAPI services, the Main thread runs a verification check:

1. **Existence Verification**: Confirms `python.exe`, `pyvenv.cfg`, and `Lib/site-packages` directories are present.
2. **Interpreter Verification**: Runs `pythonExecutable --version` to check that the binary responds.
3. **Graceful Failures**: If any validation step fails, the application displays a descriptive error message box (`dialog.showErrorBox`) and exits cleanly, avoiding silent termination or system crashes.

---

## 4. Build Pipeline Verifications

Pre-packaging checks in [buildPipeline.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/buildPipeline.js) check the bundle layout:
* Verifies that the virtual environment folder `electron/python/` exists.
* Verifies `python/Scripts/python.exe`, `python/pyvenv.cfg`, and `python/Lib/site-packages/` are ready.
* Aborts packaging if any files are missing.
