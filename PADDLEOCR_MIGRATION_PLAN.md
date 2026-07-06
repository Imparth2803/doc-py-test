# PaddleOCR Dependency Audit & Replacement Migration Plan

## Executive Summary
A comprehensive audit of the Smart Document Vault repository reveals a critical finding: **PaddleOCR is not used for primary OCR text extraction.** Core OCR is already handled by EasyOCR and PyTesseract. 
PaddleOCR (via the `PPStructure` module) is used **exclusively for Table Structure Extraction on scanned documents/images**. Removing it will not impact text extraction, orientation detection, or AI analysis, bounding the migration risk entirely to scanned table processing.

---

## Phase 1 — PaddleOCR Usage Inventory

**Files Importing/Using PaddleOCR:**
*   `server/src/services/ocr/requirements.txt`: Specifies `paddlepaddle==2.6.2` and `paddleocr==2.7.3`.
*   `server/src/services/ocr/table_server.py`:
    *   **Import**: `from paddleocr import PPStructure`
    *   **Wrapper**: `get_table_engine()` — Initializes PPStructure model lazily.
    *   **Function**: `process_paddle_tables()` — Passes OpenCV images to PPStructure, extracts HTML table representations, parses them with Pandas, and saves them to `.xlsx` files.
    *   **Purpose**: Extracts structured tables from *Scanned Documents* (where `strategy != "DIGITAL_DOCUMENT"`). 
*   *Note: Digital documents currently use `camelot` in the same file.*

---

## Phase 2 — Feature Catalog

| Feature | Used? | Where? | Required? | Can be removed? |
| :--- | :--- | :--- | :--- | :--- |
| Text Extraction | NO | N/A (Handled by EasyOCR) | - | - |
| Confidence Scores | NO | N/A (Handled by EasyOCR/PyTesseract) | - | - |
| Bounding Boxes | NO | N/A | - | - |
| Line Detection | NO | N/A | - | - |
| Word Detection | NO | N/A | - | - |
| Multi-language Support | NO | N/A | - | - |
| Page Processing | NO | N/A | - | - |
| PDF Processing | NO | N/A | - | - |
| Orientation Detection | NO | N/A (Handled by PyTesseract OSD) | - | - |
| Rotation Correction | NO | N/A | - | - |
| **Table Detection** | **YES** | `table_server.py` | YES | Yes, with replacement |
| **Table Structure Extraction** | **YES** | `table_server.py` | YES | Yes, with replacement |
| Layout Detection | NO | N/A | - | - |
| OCR Confidence Aggregation | NO | N/A | - | - |
| Handwriting Support | NO | N/A | - | - |

---

## Phase 3 — Data Contract Audit

**Trace Pipeline:**
`PPStructure` engine -> Outputs dict with `region['res']['html']` -> `pd.read_html()` -> `.xlsx` disk save -> FastAPI Response -> `tableExtractionService.ts`

**Exact Response Schema Expected by Backend (`tableExtractionService.ts`):**
```json
{
  "success": true,
  "tables": [
    {
      "tableId": "{documentId}_paddle_p{pageNumber}_t{index}",
      "pageNumber": 1,
      "rowCount": 10,
      "columnCount": 4,
      "confidence": 0.85,
      "engine": "paddle-table",
      "excelPath": "/uploads/tables/{documentId}/{filename}.xlsx"
    }
  ],
  "excelFiles": ["/uploads/tables/{documentId}/{filename}.xlsx"]
}
```

**Downstream Consumption:**
The `tableExtractionService.ts` extracts the `tables` array. If an error occurs, it is configured to return an empty array `[]` as table extraction is marked as non-blocking. 

---

## Phase 4 — Replacement Candidate Evaluation

| Candidate | Apple Silicon M2 | Windows | CPU-only | Scanned Table Accuracy | Startup Latency | Model Size | License |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PaddleOCR** (Current) | Poor (x86 transpile) | Good | Slow | High | Slow | Very Large | Apache 2.0 |
| **Docling** | Excellent | Excellent | Fast | Very High | Medium | Medium | MIT |
| **Surya (Layout/Table)** | Excellent | Excellent | Fast | High | Medium | Medium | GPLv3 |
| **Camelot / Ghostscript** | Excellent | Excellent | Fast | N/A (Digital Only) | Fast | Small | MIT |
| **OpenCV (Custom Contours) + EasyOCR** | Excellent | Excellent | Fast | Medium (Fails on borderless) | Fast | Small | Open Source |

---

## Phase 5 — Compatibility Mapping

| Current PaddleOCR Feature | Recommended Replacement |
| :--- | :--- |
| **Table Region Detection** | **Surya Layout / Docling** |
| **HTML Table Structure** | **Docling Table / Pandas DataFrame** (Docling outputs native DataFrames) |

---

## Phase 6 — Migration Risk Analysis

**What breaks if PaddleOCR is removed today?**
Only **Scanned Table Extraction**. 
Digital tables will continue to work (via Camelot). General text OCR (EasyOCR), entity extraction (GLiNER), and AI structuring (Gemini) are completely unaffected.

**Risk Classification: LOW**
Because table extraction is explicitly non-blocking in `tableExtractionService.ts` (returns `[]` on failure), the core application pipeline will not crash even if PaddleOCR is abruptly deleted. However, scanned documents will lose structured table metadata until a replacement is wired up.

---

## Phase 7 — Recommended Architecture & Roadmap

### Future Stack
*   **OCR Engine**: EasyOCR + PyTesseract (Current - Keep)
*   **Orientation Engine**: PyTesseract OSD (Current - Keep)
*   **Digital Table Engine**: Camelot (Current - Keep)
*   **Scanned Table Engine**: **Docling** 
    *   *Rationale*: Docling is heavily optimized for Apple Silicon (Metal/MPS), runs flawlessly on CPU, and outputs native Pandas DataFrames directly, cleanly replacing the `html -> pandas` hack required by PaddleOCR.

### Step-by-Step Migration Roadmap
1.  **Dependency Purge**: 
    *   Remove `paddlepaddle` and `paddleocr` from `server/src/services/ocr/requirements.txt`.
    *   Remove `import PPStructure` from `table_server.py`.
2.  **Install Replacement**: 
    *   Add `docling` to `requirements.txt`.
3.  **Refactor `table_server.py`**:
    *   Replace `get_table_engine()` to initialize `docling.document_converter.DocumentConverter`.
    *   Rewrite `process_paddle_tables()` to accept the image path, pass to Docling, and extract tables via `doc.tables`.
    *   Map the Docling dataframe outputs to the existing Excel export logic and preserve the exact JSON schema (`tableId`, `rowCount`, etc.).
4.  **Test**: 
    *   Upload a scanned invoice containing bordered tables. Validate that `.xlsx` files are generated in `/uploads/tables/` and the FastApi response conforms to the legacy schema.
