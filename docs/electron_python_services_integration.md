# Phase 4: Independent Python Microservices Integration

This document defines the process supervision, log routing, health checking, and crash recovery mechanisms implemented to let Electron manage all Python AI microservices independently.

---

## 1. Process Supervision Architecture

To satisfy the non-negotiable architectural decision, the application preserves independent Python microservices (OCR, GLiNER, and Table Extraction) instead of merging them.

Electron manages each process independently through the centralized [ServiceManager](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/serviceManager.js):

```
                       +------------------------+
                       |      ServiceManager    |
                       +------------------------+
                        /          |           \
                       /           |            \
                      v            v             v
             +------------+  +------------+  +------------+
             |    OCR     |  |   GLiNER   |  |   Tables   |
             | (Port 8001)|  | (Port 8002)|  | (Port 8003)|
             +------------+  +------------+  +------------+
```

### 1.1 Process Lifecycle Management
* **Activation & Spawning**: Spawns Python directly from the local virtual environment directory (`server/venv/bin/python` or `server/venv/Scripts/python.exe`) using `child_process.spawn`. This avoids command shell injection risks and resolves path issues across Windows and macOS/Linux.
* **Command Line Arguments**: Each process runs Uvicorn bindings on a specific port bound to local loopback `127.0.0.1`:
  * **OCR**: `python -m uvicorn src.services.ocr.ocr_server:app --port 8001 --host 127.0.0.1`
  * **GLiNER**: `python -m uvicorn src.services.gliner.gliner_server:app --port 8002 --host 127.0.0.1`
  * **Table Extraction**: `python -m uvicorn src.services.ocr.table_server:app --port 8003 --host 127.0.0.1`
* **Log Routing**: Electron redirects the stdout and stderr streams of the spawned child processes to dedicated log files in the writable user AppData logs folder:
  * `logs/ocr.log`
  * `logs/gliner.log`
  * `logs/tables.log`

---

## 2. Health Monitoring & Crash Recovery

### 2.1 Health Check Polling
When starting a service, the `ServiceManager` polls the `/health` endpoint of each FastAPI microservice (e.g. `http://127.0.0.1:8001/health`) up to 15 times with a 1-second interval. It only proceeds to the next stage in the startup sequence once the service responds with an `HTTP 200 OK`.

### 2.2 Auto-Restart Routine
* Subscribes to the `'exit'` event of the child process.
* If a service exits unexpectedly (e.g. out of memory, unhandled exception, or manual process kill) and the app is not in the middle of a shutdown, `ServiceManager` triggers an automatic restart.
* Spawns a new process after a linear backoff delay (e.g. $attempts \times 2000$ milliseconds).
* If the service fails to start successfully after 3 consecutive attempts, Electron triggers a native dialog error box to inform the user and shuts down cleanly to prevent zombie processes.

---

## 3. Web-Deployment Parity (Dev Parity)

* **Backward Compatibility**: Web development workflows (`npm run dev` in client and server folders) do not run Electron and are completely unaffected by these changes.
* **Model Parity**: The Python files, FastAPI schemas, endpoint logic, and Mongoose document processing pipelines remain completely unchanged.
