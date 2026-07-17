# Active Processing Flow

   Upload Document (client/src/components/Upload.tsx)
          |
          v
   Express Upload Endpoint (/api/documents/upload)
          |
   - Multer writes file to /uploads/
   - Creates Document and ProcessingJob (PENDING) in MongoDB
          |
          v
   Start Processing Endpoint (/api/documents/:id/process)
          |
   - Enqueues job in Redis BullMQ (queue/documentQueue.ts)
          |
          v
   BullMQ Worker (workers/documentWorker.ts)
          |
   - Triggers processDocumentWithAI()
          |
          v
   Orchestration Pipeline (services/documentProcessingService.ts)
    ├── 1. EXIF Normalization (sharp)
    ├── 2. OCR Extraction (FastAPI ocr_server.py:8001 -> EasyOCR/TrOCR)
    ├── 3. OCR Text Sanitization (ocr/ocrSanitizer.ts)
    ├── 4. Protection Check (rejects if pages > 100 or size > 20MB)
    ├── 5. Regex Metadata Extraction (metadata/metadataExtractor.ts)
    ├── 6. GLiNER Entity Extraction (FastAPI gliner_server.py:8002) [Shadow Mode]
    ├── 7. Rule-Based Classification (classification/ruleClassifier.ts) [Shadow Mode]
    ├── 8. AI Orchestrator (ai/aiOrchestrator.ts -> Gemini or Fallback Ollama)
    ├── 9. Table Extraction (FastAPI table_server.py:8003 -> Camelot/pdfplumber)
    ├── 10. SummaryFields Generation (metadata/summaryFieldBuilder.ts)
    ├── 11. Shadow Mode Comparisons (entity/classification/model benchmarks)
    └── 12. Document Schema Mapping (documentMapper.ts)
          |
          v
   Saves updated results to MongoDB & Emits Socket.io State
          |
          v
   Frontend UI Renders Extracted Data (client/src/components/Dashboard.tsx)

---

## Active Files

* **[documentController.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/controllers/documentController.ts)**: Receives file uploads, registers the initial record/job in MongoDB, and triggers processing by enqueuing into BullMQ.
* **[documentQueue.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/queue/documentQueue.ts)**: Configures the BullMQ instance backed by Redis to manage async task enqueuing.
* **[documentWorker.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/workers/documentWorker.ts)**: BullMQ worker process that consumes enqueued tasks and executes the processing pipeline.
* **[documentProcessingService.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/documentProcessingService.ts)**: The primary pipeline controller. Runs EXIF rotation, orchestrates OCR, sanitization, regex extraction, shadow extraction, AI analysis, table extraction, and merges metadata.
* **[ocrService.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/ocrService.ts)**: Interface connecting to the FastAPI OCR server (`ocr_server.py` on port 8001), running EasyOCR/TrOCR, and resolving orientations.
* **[ocrSanitizer.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/ocr/ocrSanitizer.ts)**: Normalizes OCR characters and computes quality/diagnostic metrics.
* **[glinerService.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/entities/glinerService.ts)**: Connects to the FastAPI GLiNER server (`gliner_server.py` on port 8002) for Named Entity Recognition.
* **[aiOrchestrator.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/ai/aiOrchestrator.ts)**: Routes context requests to Gemini (primary, `TEXT` mode for digital PDFs, `VISION` mode for images) or Ollama (local fallback).
* **[tableExtractionService.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/tableExtractionService.ts)**: Connects to the FastAPI Table server (`table_server.py` on port 8003) utilizing Camelot and pdfplumber.
* **[summaryFieldBuilder.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/metadata/summaryFieldBuilder.ts)**: Synthesizes extracted fields from rules, tables, regex, and LLMs into a consolidated summary fields object.
* **[documentMapper.ts](file:///Users/partht/Downloads/auto-file-ai_-smart-document-vault/server/src/services/documentMapper.ts)**: Maps the final consolidated pipeline data to matches the Mongoose `Document` schema.

---

## Data Flow & Outputs

### 1. OCR Results
* `extractedText`: Normalized text output.
* `confidence`: Average text extraction certainty.
* `strategy`: Pipeline categorization (`DIGITAL_DOCUMENT` vs `SCANNED_DOCUMENT`).
* `ocrQuality`: Diagnostics on text structure and characters.

### 2. Shadow-Mode Enrichment
* **GLiNER entities**: Lists identified stakeholders and organizations extracted via neural entity extraction.
* **Rule-based category**: Document classification derived from keyword and metadata matching rules.

### 3. AI Analysis Results
* `summary`: 2-3 sentence overview.
* `category`: LLM-determined document type.
* `tags`: Contextual indexing keywords.
* `suggestedFilename`: Generated descriptive filename.
* `summaryFields`: Key-value attributes (e.g., invoice numbers, due dates).

### 4. Table Extraction
* `tables`: Coordinates, accuracy, row/col counts, and structured cell outputs mapped to Excel files (`.xlsx`).

---

## Database Schema Mapping

Results persist to the `documents` collection inside MongoDB:
* **`document.extractedText`**: Raw cleaned text.
* **`document.status`**: Status lifecycle (`PENDING` -> `PROCESSING` -> `COMPLETED` / `FAILED`).
* **`document.docType`**: The final resolved document category.
* **`document.entities`**: Unified deduplicated list of stakeholders.
* **`document.tags`**: Array of indexing terms.
* **`document.tables`**: Holds Excel locations and cell contents.
* **`document.metadata`**: Combines `aiSummary`, `summaryFields`, regex findings, and processing/shadow-mode benchmarks.

---

## Legacy Components Removed

* **`workers/documentProcessor.ts`**: Replaced by synchronous queue-driven flow.
* **`services/geminiService.ts`** (root-level version): Superseded by the structured, vision-capable routing in `ai/aiOrchestrator.ts`.