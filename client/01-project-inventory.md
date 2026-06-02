  Comprehensive Project Inventory Audit: 
  Generating a comprehensive project inventory report covering interfaces, schemas, endpoints, and states.

  ✓  ReadFolder  server/src/models → Found 2 item(s).
  ✓  ReadFolder  server/src/routes → Found 1 item(s).
  ✓  ReadFolder  client/src/context → Found 1 item(s).
  ✓  ReadFolder  client/src/services → Found 1 item(s).
  ✓  SearchText  '^(export )?(interface|type) \w+' in **/*.ts,**/*.tsx within ./ → No matches found
  ✓  SearchText  '\b(interface|type) \w+' in **/*.ts,**/*.tsx within ./ → No matches found
  ✓  ReadFile  server/src/models/ProcessingJob.ts
  ✓  SearchText  'type' in client/src/types.ts within ./ → Found 4 matches
  ✓  ReadFile  client/src/lib/utils.ts
  ✓  ReadFile  client/src/lib/shareUtils.ts
  ✓  ReadFile  client/src/lib/utils.ts
  ✓  ReadFile  server/.../ai/confidenceService.ts
  ✓  ReadFile  server/.../ai/localModelService.ts
  ✓  ReadFile  server/.../uploadMiddleware.ts

✦ Project Inventory Report: Smart Document Vault

  This report provides a comprehensive inventory of the system's data structures, API contracts, and state management logic as of June 1,
  2026.

  ---

  1. TypeScript Interfaces & Types

  ┌──────────────────┬─────────────────────────────────────────────┬──────────┬──────────────────────────────────────────────────────┐
  │ Name             │ Location                                    │ Scope    │ Description                                          │
  ├──────────────────┼─────────────────────────────────────────────┼──────────┼──────────────────────────────────────────────────────┤
  │ IDocument        │ server/src/models/Document.ts               │ Backend  │ Mongoose document interface for primary storage.     │
  │ IProcessingJob   │ server/src/models/ProcessingJob.ts          │ Backend  │ Interface for tracking async processing status.      │
  │ AIAnalysisResult │ server/src/services/ai/geminiService.ts     │ Backend  │ Schema for Gemini AI extraction (Summary, Category,  │
  │                  │                                             │          │ etc.).                                               │
  │ AIAnalysisResult │ server/src/services/ai/localModelService.ts │ Backend  │ Interface for local LLM (Ollama/Phi3) fallback.      │
  │ Document         │ client/src/types.ts                         │ Frontend │ Core frontend document representation.               │
  │ DocumentTag      │ client/src/types.ts                         │ Frontend │ Type alias for string-based tags.                    │
  │ ApiDocument      │ client/src/types/api.ts                     │ Frontend │ DTO (Data Transfer Object) for raw API responses.    │
  │ ViewState        │ client/src/context/AppContext.tsx           │ Frontend │ Enum-like type for app navigation (login, dashboard, │
  │                  │                                             │          │ etc.).                                               │
  │ PendingDocument  │ client/src/context/AppContext.tsx           │ Frontend │ Temporary state for documents in the "Review" phase. │
  │ AppState         │ client/src/context/AppContext.tsx           │ Frontend │ Definition of the global React context state and     │
  │                  │                                             │          │ actions.                                             │
  └──────────────────┴─────────────────────────────────────────────┴──────────┴──────────────────────────────────────────────────────┘
  ---

  2. MongoDB Schemas

  ┌────────────────┬────────────────────────────────────┬─────────────────────────────────────────┬────────────────────────────────┐
  │ Collection     │ Schema Definition File             │ Key Fields                              │ Indexes                        │
  ├────────────────┼────────────────────────────────────┼─────────────────────────────────────────┼────────────────────────────────┤
  │ Documents      │ server/src/models/Document.ts      │ originalName, storagePath, mimeType,    │ userId (idx), status (idx),    │
  │                │                                    │ status, tags, entities, docType,        │ GlobalSearchIndex (text)       │
  │                │                                    │ metadata                                │                                │
  │ ProcessingJobs │ server/src/models/ProcessingJob.ts │ documentId, status, attempts, errorLogs │ documentId (idx), status (idx) │
  └────────────────┴────────────────────────────────────┴─────────────────────────────────────────┴────────────────────────────────┘
  ---

  3. API Endpoints (Backend)

  ┌────────┬────────────────────────────┬─────────────────────┬────────────────────────────────────────────────────────┐
  │ Method │ Route                      │ Controller Function │ Description                                            │
  ├────────┼────────────────────────────┼─────────────────────┼────────────────────────────────────────────────────────┤
  │ POST   │ /api/documents/upload      │ uploadDocument      │ Handles file upload via Multer and creates DB records. │
  │ POST   │ /api/documents/:id/process │ processDocument     │ Triggers Gemini AI analysis for a specific document.   │
  │ GET    │ /api/documents             │ getDocuments        │ Retrieves all documents, sorted by newest first.       │
  │ GET    │ /api/documents/:id         │ getDocumentById     │ Retrieves full details of a single document.           │
  │ GET    │ /api/documents/job/:id     │ getJobStatus        │ Checks the status of an async processing task.         │
  └────────┴────────────────────────────┴─────────────────────┴────────────────────────────────────────────────────────┘
  ---

  4. Frontend API Calls (documentApi.ts)

  ┌─────────────────┬────────┬────────────────────────────┬─────────────────────────────────────────────────┐
  │ Function Name   │ Method │ Destination URL            │ Payload / Return                                │
  ├─────────────────┼────────┼────────────────────────────┼─────────────────────────────────────────────────┤
  │ getDocuments    │ GET    │ /api/documents             │ Returns Promise<ApiDocument[]>                  │
  │ uploadDocument  │ POST   │ /api/documents/upload      │ Payload: FormData. Returns Promise<ApiDocument> │
  │ processDocument │ POST   │ /api/documents/:id/process │ Returns Promise<ApiDocument>                    │
  └─────────────────┴────────┴────────────────────────────┴─────────────────────────────────────────────────┘
  ---

  5. React Context States (AppContext.tsx)

  ┌────────────────┬────────────────────┬───────────────┬──────────────────────────────────────────────────────┐
  │ State Variable │ Type               │ Default Value │ Description                                          │
  ├────────────────┼────────────────────┼───────────────┼──────────────────────────────────────────────────────┤
  │ currentView    │ ViewState          │ 'login'       │ Manages the primary navigation/routing of the SPA.   │
  │ documents      │ ApiDocument[]      │ []            │ The global list of documents displayed in the UI.    │
  │ pendingDoc     │ `PendingDocument \ │ null`         │ null                                                 │
  │ customFolders  │ string[]           │ []            │ User-defined folder names added during filing.       │
  │ aiUnits        │ number             │ 485           │ Virtual credits remaining for AI operations.         │
  │ aiCredits      │ number             │ 142.50        │ Currency balance (INR) remaining for AI operations.  │
  │ aiUnitsUsed    │ number             │ 1245          │ Lifetime total of AI units consumed.                 │
  │ aiCreditsUsed  │ number             │ 373.50        │ Lifetime total expenditure on AI credits.            │
  │ isPricingOpen  │ boolean            │ false         │ Controls the visibility of the Pricing/Top-up modal. │
  └────────────────┴────────────────────┴───────────────┴──────────────────────────────────────────────────────┘
  ---

  📋 Observations
   * Infrastructure: The project uses a mix of cloud AI (Gemini) and local AI (Ollama/Phi3), though Gemini is the primary path.
   * Validation: Middleware in uploadMiddleware.ts enforces file type restrictions (PDF, JPEG, PNG, WEBP).
   * Storage: Files are stored on disk in /server/uploads/ with unique timestamps prefixed to their names.
   * Search: A text-based GlobalSearchIndex is prepared in MongoDB for future semantic or keyword search features.