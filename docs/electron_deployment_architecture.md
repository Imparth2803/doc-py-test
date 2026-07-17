# Phase 0: Electron Deployment Architecture

This document defines the architectural blueprints, directory layouts, and process initialization dependencies required to pack the **Smart Document Vault** as a self-contained, offline-first Windows Electron desktop application.

---

## 1. Architectural Principles

To ensure successful packaging and execution on target Windows machines without pre-installed dependencies:
1. **No Monolithic Merge**: Keep the Python microservices (OCR, GLiNER, and Tables) separate. Running them as isolated processes preserves fast recovery loops, limits memory leaks, and isolates model loading.
2. **Process Isolation**: Electron manages child lifecycles individually. If a Python microservice exits unexpectedly, only that service is restarted.
3. **Database Portability**: MongoDB is decoupled from the Atlas environment and runs locally. The Express server interacts with the database through a central abstraction layer, unaware of the underlying connection mode.
4. **Writable Directory Relocation**: All file operations, databases, and logs are redirected from the static (read-only) application installation folder to writable user profiles.

---

## 2. Startup Dependency Graph

On launching the desktop application, the Electron Main Process manages startup ordering using healthy check gates (HTTP heartbeats/socket connections):

```
+-----------------------------------+
|       Electron Main Process       |
+-----------------------------------+
                  |
                  v
       [1. Launch MongoDB]
                  |
                  v
       [2. Poll MongoDB Health] 
                  | (Connection Responsive)
                  v
       [3. Launch Express Backend]
                  |
                  v
       [4. Poll Backend /health]
                  | (HTTP 200 OK)
                  v
       [5. Launch OCR Service]
                  |
                  v
       [6. Poll OCR /health]
                  | (HTTP 200 OK)
                  v
       [7. Launch GLiNER Service]
                  |
                  v
       [8. Poll GLiNER /health]
                  | (HTTP 200 OK)
                  v
   [9. Launch Table Extraction Service]
                  |
                  v
       [10. Poll Tables /health]
                  | (HTTP 200 OK)
                  v
        [11. Launch React UI]
```

### Startup Gating Rules:
* Each service must satisfy its connection test before the downstream service starts.
* If a service fails to initialize after a timeout (e.g., 10 seconds), the launcher stops, logs the diagnostic crash, and displays a recovery message in the UI rather than launching a broken screen.

---

## 3. Directory Layout (Application Data)

In a packaged Electron deployment, the installation directory is read-only (e.g., `Program Files`). To support file writes, the application relocates its workspace dynamically to the Windows User AppData folder:
`%LOCALAPPDATA%\SmartDocumentVault\` (typically `C:\Users\<Username>\AppData\Local\SmartDocumentVault\`)

The directories are organized as follows:

```
%LOCALAPPDATA%\SmartDocumentVault\
├── mongodb\
│   └── data\             <-- MongoDB physical database storage (--dbpath)
├── uploads\
│   └── documents\        <-- Extracted/uploaded document storage
├── logs\
│   ├── backend.log       <-- Express server logs
│   ├── mongodb.log       <-- MongoDB output logs
│   └── services\         <-- Microservices runtime logs
├── temp\                 <-- Indexing and PDF decryption cache (cleaned on exit)
├── backups\              <-- Local zip archives and database dumps
├── config\
│   └── settings.json     <-- User preferences (theme, offline caching state)
├── models\               <-- Downloaded/cached GLiNER & PaddleOCR model weights
└── thumbnails\           <-- Extracted visual page previews for PDF archives
```
