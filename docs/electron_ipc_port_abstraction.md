# Electron IPC and Port Abstraction Architecture

This document outlines the refactored Electron desktop shell integration, showing how the app eliminates hardcoded localhost ports in the UI and abstracts API calls and WebSockets using Electron IPC.

---

## 1. IPC Architecture (Fetch & Axios Interception)

The application intercepts all outgoing HTTP/REST API calls and WebSocket connections on the React side (if running inside Electron) and redirects them through secure Electron IPC channels:

```
+-------------------------------------------------------------+
|                       React Renderer                        |
+-------------------------------------------------------------+
    |                                                     |
    | (Fetch/Axios Request)                               | (Socket.io Event)
    v                                                     v
+------------------+                               +------------------+
|   Fetch/Axios    |                               |   Virtual Socket |
|  IPC Interceptor |                               |   IPC Tunnel     |
+------------------+                               +------------------+
    |                                                     |
    | ipcRenderer.invoke('api-request')                   | ipcRenderer.send('socket-on')
    v                                                     v
+-------------------------------------------------------------+
|                         Preload Bridge                      |
+-------------------------------------------------------------+
    |                                                     |
    | (Secure IPC Channel Tunnel)                         | (IPC Socket Events)
    v                                                     v
+-------------------------------------------------------------+
|                    Electron Main Process                    |
+-------------------------------------------------------------+
    |                                                     |
    | (Resolves dynamic port from registry)               | (Node socket.io-client)
    v                                                     v
+------------------+                               +------------------+
|   Native Fetch   |                               |  Physical Socket |
|   Local HTTP     |                               |   Relay Client   |
+------------------+                               +------------------+
    |                                                     |
    v                                                     v
+-------------------------------------------------------------+
|                     Local Express Server                    |
+-------------------------------------------------------------+
```

### 1.1 Global Fetch & Axios Interceptor
* Located in [main.tsx](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/client/src/main.tsx).
* When `window.electronAPI` is present, it overrides:
  * **`window.fetch`**: Intercepts requests containing `/api/` and routes them via `electronAPI.apiCall`.
  * **`axios.defaults.adapter`**: Intercepts all Axios calls (used in Google Login) and routes them via `electronAPI.apiCall`.
* For multipart uploads (document files), the interceptor extracts the file's absolute path (provided by Electron's extended `file.path` property) and transmits the path over IPC instead of the un-serializable raw `FormData` object.

### 1.2 Virtual Socket Bridge
* Located in [useSocket.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/client/src/hooks/useSocket.ts).
* If running inside Electron, it bypasses the physical socket creation and returns a virtual socket object.
* This virtual socket transmits subscription commands (`socket-on`, `socket-off`) over IPC.
* The Electron Main Process maintains a single Node-level `socket.io-client` connection to the Express server, intercepts the requested events, and tunnels the payloads back to the React UI using `webContents.send()`.

---

## 2. Runtime Service Registry Design

Electron acts as the central service discovery directory. It tracks all services inside [registry.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/registry.js):

| Service | Port Assignment | Process Handle | Health Status |
| :--- | :--- | :--- | :--- |
| **MongoDB** | Dynamic (or 27017) | `mongoProcess` child | `healthy` boolean |
| **Express Backend** | Dynamic (or 8000) | `backendProcess` child | `healthy` boolean |
| **OCR** | Dynamic (or 8001) | `ocr` Python child | `healthy` boolean |
| **GLiNER** | Dynamic (or 8002) | `gliner` Python child | `healthy` boolean |
| **Tables** | Dynamic (or 8003) | `tables` Python child | `healthy` boolean |

---

## 3. Policy-Based Startup & Health Monitoring

All hardcoded timing variables and retry numbers have been replaced with configurable settings in [config.js](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/electron/config.js):
* **Startup Timeout**: Max milliseconds to wait for health endpoints.
* **Health Check Interval**: Tick frequency between poll attempts.
* **Max Restarts**: Max restart attempts for failed services.
* **Backoff Policy**: Linear delay multiplier ($attempts \times backoffDelay$).

### Service Readiness Criteria
A service is only registered as healthy when it returns an HTTP `200 OK` from its health endpoint, matching specific JSON keys:
* OCR/GLiNER/Tables: Expects `{"status": "healthy"}` at `/health`.
* Express Backend: Expects a valid collection list at `/api/documents`.

---

## 4. Port Collision & Conflict Handling

The application performs port availability checks before initiating any process:
1. **Free Port**: If the target port is free, the service is spawned normally.
2. **Re-use**: If the port is in use, Electron pings its health signature. If it responds with the expected health response, Electron registers the existing running service and uses it (allowing development hot-reloads to run seamlessly).
3. **Collision Halt**: If the port is in use by an external process, Electron displays a native dialog box specifying the port conflict and exits cleanly, avoiding unhandled `EADDRINUSE` exceptions.

---

## 5. Web-Deployment Parity (Dev Parity)

* **Parity**: If the app is launched outside Electron (i.e. `npm run dev`), the `window.electronAPI` object is undefined.
* **Fallback**: The React application falls back to standard browser HTTP requests to `http://localhost:8000` and normal WebSockets via `socket.io-client`, preserving full web deployment parity.
