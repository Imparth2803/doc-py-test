# Local Ollama & Qwen Model Offline Setup

This document describes how the application bundles and manages the local Ollama server and Qwen AI model completely offline.

---

## 1. Directory Structure

Ollama server executable, Modelfile configuration, and GGUF model weights are packaged within the application resources:

```
SmartDocumentVault/
├── SmartDocumentVault.exe
└── resources/
    ├── bin/
    │   ├── mongod.exe
    │   ├── ollama           <-- macOS/Linux binary
    │   └── ollama.exe       <-- Windows binary
    │
    ├── models/
    │   └── qwen/
    │       ├── Modelfile        <-- Ollama instructions pointing to local GGUF
    │       └── qwen2.5-1.5b.gguf <-- Offline model weights (approx. 980MB)
    │
    └── ...
```

---

## 2. Dynamic Path & Port Discovery

* **Path Resolution**: Resolved in [runtimeConfig.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/runtimeConfig.js) via `getOllamaPath()`.
* **Port Mapping**: Default port `11434` is declared in [config.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/config.js).
* **Environment Injection**: The environment variables inject `OLLAMA_HOST=127.0.0.1:11434` and `OLLAMA_MODELS=<userData>/models/ollama` to ensure local routing and isolate cached weights inside the application sandbox.

---

## 3. Server Lifecycle Manager (`ollamaManager.js`)

The [OllamaManager](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/ollamaManager.js) supervises execution:

1. **Port Occupancy Verification**: Scans port `11434`. If occupied by a compatible Ollama instance (returns status `200` on `/api/tags`), it reuses the connection. If occupied by an incompatible service, it raises a collision exception.
2. **Background Spawning**: Spawns the local binary `ollama serve` and routes stderr/stdout streams to `logs/ollama.log`.
3. **Pre-flight Polling**: Polls the tags endpoint `/api/tags` to verify readiness.
4. **Offline Model Compilation (First Launch)**: Once healthy, it queries the list of compiled models. If `qwen2.5:1.5b` is missing, it runs:
   ```bash
   ollama create qwen2.5:1.5b -f resources/models/qwen/Modelfile
   ```
   to compile and import the GGUF model weights offline without requiring internet access.
5. **Crash-loop Recovery**: Supports up to 3 automatic restart attempts with backoff before raising a system error window and shutting down cleanly.

---

## 4. Build Pipeline Validation Checks

Pre-flight build validation checks are declared in [buildPipeline.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/buildPipeline.js):
* Asserts presence of local `bin/ollama.exe` (or host binary).
* Asserts presence of `models/qwen/Modelfile` configuration descriptor.
* Asserts presence of `models/qwen/qwen2.5-1.5b.gguf` weights binary.
* Aborts packaging on verification failures.
