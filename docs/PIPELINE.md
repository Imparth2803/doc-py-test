# Active Processing Flow

Upload
→ `documentController`
→ `documentProcessingService`
→ `ocrService`
→ `ai/geminiService`
→ `documentMapper`
→ MongoDB
→ Frontend

---

## Active Files

* **`documentController.ts`**: Handles the Express API routes, receives file uploads, saves the initial placeholder record to MongoDB, and routes the processing request to the processing service.
* **`documentProcessingService.ts`**: The main orchestrator. It executes the synchronous processing pipeline: EXIF normalizations, OCR extraction, AI structured data generation, image rotation correction, and final database saves.
* **`ocrService.ts`**: Executes optical character recognition on the physical file to extract raw text and determines the primary processing strategy based on confidence.
* **`ai/geminiService.ts`**: Communicates with the Google Gemini API using a strict schema to extract intelligent summaries, document categories, entities, tags, and structured `summaryFields` from the image and OCR text.
* **`documentMapper.ts`**: Standardizes the disparate outputs from the OCR engine, the AI engine, and the vault classification logic into a single uniform payload ready for MongoDB persistence.

---

## Data Flow

### OCR Result
Produces:
* `extractedText` (The raw text from the image/PDF)
* `confidence` (The certainty of the OCR extraction)
* `strategy` (The chosen pipeline path, e.g., 'DIGITAL_DOCUMENT' or 'SCANNED_DOCUMENT')

### AI Result
Produces:
* `summary` (A 2-3 sentence description of the document)
* `category` (The specific document type, e.g., 'Electricity Bill')
* `entities` (A list of primary stakeholders or owners)
* `tags` (Search-friendly contextual keywords)
* `suggestedFilename` (A clean, human-readable name)
* `summaryFields` (An object containing extracted key-value pairs like Due Date, Amounts)

### Mapper
Converts the OCR and AI results into the unified structure expected by the `Document` Mongoose model, preserving nested structures in a format easily readable by the frontend UI.

---

## Database Persistence

The data is mapped and stored in MongoDB under the `Document` collection as follows:

* **`extractedText`**: `document.extractedText`
* **`metadata.aiSummary`**: `document.metadata.aiSummary`
* **`metadata.summaryFields`**: `document.metadata.summaryFields`
* **`entities`**: `document.entities` AND `document.metadata.aiEntities`
* **`tags`**: `document.tags` AND `document.metadata.aiTags`
* **`docType`**: `document.docType`

---

## Legacy Components Removed

* **`workers/documentProcessor.ts`**
* **`services/geminiService.ts`** (root-level version)

**Reason:** 
Inactive / unreferenced legacy pipeline. The background worker was bypassed in favor of synchronous processing, and the old gemini service was superseded by `ai/geminiService.ts` which handles Vision and strict schemas.