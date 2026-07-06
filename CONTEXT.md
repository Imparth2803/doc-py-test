# 1. Project Overview

*   **Frontend framework**: React + Vite
*   **Backend framework**: Express.js + TypeScript
*   **Database**: MongoDB (Mongoose)
*   **OCR services**: FastAPI (Python), EasyOCR, PaddleOCR
*   **AI services**: Gemini (Primary via Google API), Local LLMs (Ollama/Qwen via Ollama)
*   **Queue system**: BullMQ backed by Redis
*   **Storage system**: Local filesystem (`/server/uploads/`)

---

# 2. Runtime Services

**Frontend**
*   **Purpose**: User interface, SPA
*   **Entrypoint**: `client/src/main.tsx` (Vite dev server)
*   **Default Port**: 3000 (configurable via `FRONTEND_PORT`)
*   **Dependencies**: React, Vite
*   **Environment Variables**: `FRONTEND_PORT`, `FRONTEND_HOST`

**Backend (Express API)**
*   **Purpose**: Primary API router and orchestration
*   **Entrypoint**: `server/src/index.ts`
*   **Default Port**: 8000
*   **Dependencies**: Express, Mongoose, Multer
*   **Environment Variables**: `PORT`, `MONGO_URI`, `JWT_SECRET`, `PRIMARY_AI_PROVIDER`

**OCR Server**
*   **Purpose**: Optical character recognition extraction
*   **Entrypoint**: `server/src/services/ocr/ocr_server.py`
*   **Default Port**: 8001
*   **Dependencies**: FastAPI, EasyOCR, Uvicorn
*   **Environment Variables**: `OCR_SERVICE_HOST`, `OCR_SERVICE_PORT`

**Table Extraction Server**
*   **Purpose**: Structural table extraction
*   **Entrypoint**: `server/src/services/ocr/table_server.py`
*   **Default Port**: 8003
*   **Dependencies**: FastAPI
*   **Environment Variables**: `TABLE_SERVICE_HOST`, `TABLE_SERVICE_PORT`

**GLiNER Server**
*   **Purpose**: Named entity recognition
*   **Entrypoint**: `server/src/services/entities/gliner/gliner_server.py`
*   **Default Port**: 8002
*   **Dependencies**: FastAPI, GLiNER
*   **Environment Variables**: `GLINER_HOST`, `GLINER_PORT`

**Redis**
*   **Purpose**: Message broker for BullMQ async processing jobs
*   **Default Port**: 6379
*   **Environment Variables**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

**MongoDB**
*   **Purpose**: Primary database storage for documents and jobs
*   **Connection source file**: `server/src/config/db.ts`
*   **Environment Variables**: `MONGO_URI`

**Ollama (Local AI Server)**
*   **Purpose**: Runs local LLMs for offline AI analysis
*   **Default Port**: 11434
*   **Environment Variables**: `OLLAMA_HOST`, `OLLAMA_PORT`, `LOCAL_ANALYSIS_MODEL`

---

# 3. Port Inventory

| Port  | Service                        | Files Referencing It                                        |
| :---- | :----------------------------- | :---------------------------------------------------------- |
| 3000  | Frontend (React/Vite)          | `server/src/config/services.ts`                             |
| 8000  | Backend (Express API)          | `server/src/config/services.ts`, `server/src/index.ts`, `client/src/utils/storagePathUtils.ts`, `client/src/components/Login.tsx`, `client/src/components/Upload.tsx`, `client/src/services/documentApi.ts` |
| 8001  | OCR Service (FastAPI)          | `server/src/config/services.ts`                             |
| 8002  | GLiNER Service (FastAPI)       | `server/src/config/services.ts`                             |
| 8003  | Table Service (FastAPI)        | `server/src/config/services.ts`                             |
| 6379  | Redis                          | `server/src/config/services.ts`                             |
| 11434 | Ollama (Local AI)              | `server/src/config/services.ts`                             |

---

# 4. Database Inventory

**Document**
*   **Collection Name**: `documents`
*   **File Location**: `server/src/models/Document.ts`
*   **Key Fields**: `originalName`, `storagePath`, `mimeType`, `status`, `tags`, `entities`, `docType`, `metadata` (including `aiSummary`, `summaryFields`)

**ProcessingJob**
*   **Collection Name**: `processingjobs`
*   **File Location**: `server/src/models/ProcessingJob.ts`
*   **Key Fields**: `documentId`, `status`, `attempts`, `errorLogs`

**User**
*   **Collection Name**: `users`
*   **File Location**: `server/src/models/User.ts`
*   **Key Fields**: Google OAuth fields, credentials.

---

# 5. API Inventory

### Auth Controller
*   **Method**: `POST`
*   **Route**: `/api/auth/google` 
*   **Controller**: `authController.ts`
*   **Purpose**: Handle Google OAuth login and issue JWT.

### Document Controller
*   **Method**: `GET`
*   **Route**: `/api/documents`
*   **Controller**: `documentController.ts`
*   **Purpose**: Get all documents.

*   **Method**: `GET`
*   **Route**: `/api/documents/:id`
*   **Controller**: `documentController.ts`
*   **Purpose**: Get a single document.

*   **Method**: `POST`
*   **Route**: `/api/documents/upload`
*   **Controller**: `documentController.ts`
*   **Purpose**: Handle file upload via Multer and save placeholder record.

*   **Method**: `PATCH`
*   **Route**: `/api/documents/:id`
*   **Controller**: `documentController.ts`
*   **Purpose**: Update a document's metadata.

*   **Method**: `POST`
*   **Route**: `/api/documents/:id/process`
*   **Controller**: `documentController.ts`
*   **Purpose**: Initiate asynchronous or synchronous AI document processing.

*   **Method**: `GET`
*   **Route**: `/api/documents/job/:id`
*   **Controller**: `documentController.ts`
*   **Purpose**: Poll processing job status.

*   **Method**: `POST`
*   **Route**: `/api/documents/:id/rotate`
*   **Controller**: `documentController.ts`
*   **Purpose**: Rotate document image.

*   **Method**: `DELETE`
*   **Route**: `/api/documents/:id`
*   **Controller**: `documentController.ts`
*   **Purpose**: Delete document.

---

# 6. Processing Pipeline

**Trace:**
1.  **Upload**: `server/src/controllers/documentController.ts`
2.  **Mongo Save**: `server/src/controllers/documentController.ts` (Initial Pending state)
3.  **Queue**: `server/src/queue/documentQueue.ts`
4.  **Worker**: `server/src/workers/documentWorker.ts`
5.  **Processing Orchestrator**: `server/src/services/documentProcessingService.ts`
6.  **OCR**: `server/src/services/ocrService.ts` -> Calls OCR FastAPI server.
7.  **Entity Extraction**: `server/src/services/entities/glinerService.ts`
8.  **AI Analysis**: `server/src/services/ai/aiOrchestrator.ts` -> `server/src/services/ai/geminiProvider.ts`
9.  **Mongo Update**: `server/src/services/documentMapper.ts` -> `Document` Model save.
10. **Frontend Display**: `client/src/context/AppContext.tsx` -> `client/src/components/EntityView.tsx`

---

# 7. AI Inventory

*   **Provider Name**: Gemini
    *   **File**: `server/src/services/ai/geminiProvider.ts`
    *   **Model**: Gemini Multi-modal models
    *   **Purpose**: Primary OCR structuring, categorization, summarization, entity extraction.
    *   **Status**: ACTIVE

*   **Provider Name**: LocalAI (Ollama / Qwen)
    *   **File**: `server/src/services/ai/localProvider.ts` / `server/src/services/analysis/localDocumentAnalyzer.ts`
    *   **Model**: `qwen2.5:1.5b`
    *   **Purpose**: Local fallback LLM processing.
    *   **Status**: FALLBACK

*   **Provider Name**: GLiNER
    *   **File**: `server/src/services/entities/gliner/glinerService.ts`
    *   **Model**: GLiNER Models
    *   **Purpose**: Lightweight Named Entity Recognition
    *   **Status**: ACTIVE

---

# 8. OCR Inventory

*   **FastAPI OCR Server**
    *   **Port**: 8001
    *   **Entrypoint**: `server/src/services/ocr/ocr_server.py`
    *   **Dependencies**: EasyOCR, FastAPI, Uvicorn

*   **FastAPI Table Server**
    *   **Port**: 8003
    *   **Entrypoint**: `server/src/services/ocr/table_server.py`
    *   **Dependencies**: FastAPI, Uvicorn

---

# 9. Queue Inventory

*   **Broker**: Redis
*   **Queue System**: BullMQ
*   **Queue Configuration**: `server/src/queue/documentQueue.ts`
*   **Queue Name**: `document-processing-queue`
*   **Worker Name**: `documentWorker` (`server/src/workers/documentWorker.ts`)
*   **Job Schemas**: Managed in `server/src/models/ProcessingJob.ts`

**Exact Flow**:
1. Controller adds job via `documentQueue.add()`.
2. Redis tracks job ID and state.
3. `documentWorker` picks up job, invokes `documentProcessingService.ts`.
4. Job updates progress inside `queueEvents.ts`.
5. DB `ProcessingJob` document is updated with status `COMPLETED` or `FAILED`.

---

# 10. Environment Variables

*   `FRONTEND_HOST` / `FRONTEND_PORT`: Frontend URL and port
*   `BACKEND_HOST` / `BACKEND_PORT`: Backend URL and port
*   `OCR_SERVICE_HOST` / `OCR_SERVICE_PORT`: OCR Server host/port
*   `GLINER_HOST` / `GLINER_PORT`: NER Server host/port
*   `TABLE_SERVICE_HOST` / `TABLE_SERVICE_PORT`: Table extraction host/port
*   `OLLAMA_HOST` / `OLLAMA_PORT`: Ollama server details
*   `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`: BullMQ redis connection details
*   `MONGO_URI`: MongoDB connection string
*   `JWT_SECRET`: Secret for signing auth tokens
*   `GOOGLE_CLIENT_ID`: OAuth client ID
*   `GEMINI_API_KEY`: API key for primary AI processing
*   `PRIMARY_AI_PROVIDER`: Select active AI
*   `ENABLE_GEMINI_SHADOW`: Shadow mode testing flag
*   `LOCAL_ANALYSIS_MODEL`: Local LLM model choice

---

# 11. Frontend Navigation Map

State managed by `AppContext.tsx` (`currentView` enum).

*   **Login**: Initial auth screen.
*   **Dashboard**: Displays documents. Toggles between folder tree (`TreeView`) and flat entity list (`EntityView`).
*   **Upload**: Component triggered by clicking the "+" button. Navigates to pending review on success.
*   **Review**: Inspect uploaded document and adjust rotation/details.
*   **Archive**: View for past documents.

---

# 12. Dead Code Inventory

*   `server/src/workers/documentProcessor.ts` - **SAFE TO DELETE** (Legacy background worker replaced by synchronous flow).
*   `server/src/services/geminiService.ts` (root-level) - **SAFE TO DELETE** (Superseded by `ai/geminiProvider.ts`).
*   Queue/Redis Implementation (`server/src/queue`, `server/src/workers/documentWorker.ts`) - **NEEDS REVIEW** (May be orphaned since synchronous processing took over, but init logic is still present in `index.ts`).

---

# 13. Startup Checklist

1.  **MongoDB**: Ensure MongoDB connection is established locally or via Atlas.
2.  **Redis**: Run Redis for BullMQ (`redis-server`).
3.  **OCR / Microservices Server**:
    *   `cd server/src/services/ocr && uvicorn ocr_server:app --port 8001`
    *   `cd server/src/services/ocr && uvicorn table_server:app --port 8003`
    *   `cd server/src/services/entities/gliner && uvicorn gliner_server:app --port 8002`
4.  **Express Server**:
    *   `cd server && npm run dev`
5.  **Frontend**:
    *   `cd client && npm run dev`
