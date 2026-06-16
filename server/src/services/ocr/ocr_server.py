from fastapi import FastAPI, Request
from pydantic import BaseModel
import logging
import time
import asyncio
import os
import pandas as pd
import camelot
import fitz  # PyMuPDF
import cv2
import numpy as np
import pdfplumber
from paddleocr import PPStructure, PaddleOCR
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from src.services.ocr.ocr_core import get_ocr_instance, perform_ocr

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "name": "%(name)s", "level": "%(levelname)s", "message": %(message)s}'
)
logger = logging.getLogger("OCRServer")

app = FastAPI(title="Smart Document Vault OCR & Table Service")

# Concurrency Control
ocr_semaphore = asyncio.Semaphore(1)
table_semaphore = asyncio.Semaphore(1)

# Ensure tables directory exists
TABLES_DIR = os.path.join(os.getcwd(), "uploads", "tables")
os.makedirs(TABLES_DIR, exist_ok=True)

logger.info('"Loading PaddleOCR Singleton Model..."')
ocr_instance = get_ocr_instance(language="hi")

logger.info('"Loading Paddle Table Recognition Model (PP-Structure)..."')
table_engine = PPStructure(show_log=True, lang='en', layout=False, table=True, ocr=True)

logger.info('"Initializing Docling Fallback Engine (Lazy Loading Logic)..."')
# Docling is heavy, we'll initialize converter with options but models load on first use
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = True
pipeline_options.do_table_structure = True

docling_converter = None

logger.info('"All ML models initialized."')

class OCRRequest(BaseModel):
    file_path: str
    language: str = "hi"

class TableRequest(BaseModel):
    file_path: str
    strategy: str = "DIGITAL_DOCUMENT"

def detect_table_pages_digital(file_path):
    candidate_pages = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if page.find_tables() or len(page.horizontal_edges) > 5:
                    candidate_pages.append(i + 1)
    except Exception as e:
        logger.error(f"Digital detection error: {str(e)}")
        return "all"
    return candidate_pages if candidate_pages else [1]

def detect_table_pages_scanned(file_path):
    candidate_pages = []
    try:
        doc = fitz.open(file_path)
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=fitz.Matrix(1, 1)) 
            img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.wid, pix.n)
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY) if pix.n == 3 else img_np
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1)))
            v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40)))
            if len(cv2.findContours(h_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]) > 4:
                candidate_pages.append(i + 1)
        doc.close()
    except Exception as e:
        logger.error(f"Scanned detection error: {str(e)}")
        return "all"
    return candidate_pages if candidate_pages else [1]

def process_camelot_tables(tables, engine_name, document_id):
    result_tables = []
    doc_table_dir = os.path.join(TABLES_DIR, document_id)
    os.makedirs(doc_table_dir, exist_ok=True)
    
    for i, table in enumerate(tables):
        table_id = f"{document_id}_{engine_name}_t{i}"
        excel_name = f"{table_id}.xlsx"
        excel_path = os.path.join(doc_table_dir, excel_name)
        table.to_excel(excel_path)
        
        result_tables.append({
            "tableId": table_id, "pageNumber": table.page, "rowCount": table.df.shape[0],
            "columnCount": table.df.shape[1], "confidence": round(table.accuracy / 100.0, 4),
            "engine": f"camelot-{engine_name}", "excelPath": f"/uploads/tables/{document_id}/{excel_name}"
        })
    return result_tables

def process_paddle_tables(image, page_num, document_id, table_index):
    result = table_engine(image)
    tables_found = []
    doc_table_dir = os.path.join(TABLES_DIR, document_id)
    os.makedirs(doc_table_dir, exist_ok=True)

    for i, region in enumerate(result):
        if region['type'] == 'table':
            table_id = f"{document_id}_paddle_p{page_num}_t{table_index + i}"
            excel_name = f"{table_id}.xlsx"
            excel_path = os.path.join(doc_table_dir, excel_name)
            try:
                dfs = pd.read_html(region['res']['html'])
                if dfs:
                    df = dfs[0]
                    df.to_excel(excel_path, index=False)
                    tables_found.append({
                        "tableId": table_id, "pageNumber": page_num, "rowCount": df.shape[0],
                        "columnCount": df.shape[1], "confidence": 0.85, "engine": "paddle-table",
                        "excelPath": f"/uploads/tables/{document_id}/{excel_name}"
                    })
            except Exception as e:
                logger.error(f"Paddle HTML to Excel error: {str(e)}")
    return tables_found

async def process_docling_fallback(file_path, document_id):
    """
    High-fidelity fallback using IBM Docling for complex layouts.
    """
    logger.info(f'{{"event": "docling_fallback_start", "file_path": "{file_path}"}}')
    start_time = time.time()
    result_tables = []
    doc_table_dir = os.path.join(TABLES_DIR, document_id)
    os.makedirs(doc_table_dir, exist_ok=True)

    try:
        # Docling handles the whole document and performs intelligent layout analysis
        conv_res = docling_converter.convert(file_path)
        doc = conv_res.document

        for i, table in enumerate(doc.tables):
            table_id = f"{document_id}_docling_t{i}"
            excel_name = f"{table_id}.xlsx"
            excel_path = os.path.join(doc_table_dir, excel_name)
            
            # Export to dataframe
            df = table.export_to_dataframe()
            df.to_excel(excel_path, index=False)
            
            # Map to normalized schema
            result_tables.append({
                "tableId": table_id,
                "pageNumber": table.prov[0].page_no if table.prov else 1,
                "rowCount": len(df),
                "columnCount": len(df.columns),
                "confidence": 0.95, # Docling doesn't expose raw scores easily, but is high fidelity
                "engine": "docling-v2",
                "excelPath": f"/uploads/tables/{document_id}/{excel_name}"
            })
        
        duration = time.time() - start_time
        logger.info(f'{{"event": "docling_fallback_success", "tables_found": {len(result_tables)}, "duration_ms": {round(duration * 1000)}}}')
        return result_tables
    except Exception as e:
        logger.error(f"Docling fallback error: {str(e)}")
        return []

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ocr-table-service"}

@app.post("/extract-tables")
async def extract_tables(req: TableRequest):
    document_id = os.path.basename(req.file_path).split('_')[0]
    if len(document_id) < 5: document_id = os.path.basename(req.file_path).replace(".", "_")

    logger.info(f'{{"event": "table_extraction_start", "file_path": "{req.file_path}", "strategy": "{req.strategy}"}}')
    
    async with table_semaphore:
        start_time = time.time()
        result_tables = []
        fallback_required = False
        fallback_reason = ""
        
        try:
            # --- PHASE 1: Detection ---
            if req.strategy == "DIGITAL_DOCUMENT":
                candidate_pages = detect_table_pages_digital(req.file_path)
            else:
                candidate_pages = detect_table_pages_scanned(req.file_path)

            page_str = "all" if candidate_pages == "all" else ",".join(map(str, candidate_pages))

            # --- PHASE 2: Primary Engines ---
            if req.strategy == "DIGITAL_DOCUMENT":
                engine_used = "lattice"
                tables = camelot.read_pdf(req.file_path, pages=page_str, flavor='lattice')
                if len(tables) == 0:
                    engine_used = "stream"
                    tables = camelot.read_pdf(req.file_path, pages=page_str, flavor='stream')
                
                result_tables = process_camelot_tables(tables, engine_used, document_id)
                
                # Check for Fallback: No tables found or low confidence
                if not result_tables:
                    fallback_required = True
                    fallback_reason = "camelot_zero_results"
                elif any(t['confidence'] < 0.6 for t in result_tables):
                    fallback_required = True
                    fallback_reason = "low_confidence_lattice"
            
            else:
                # Scanned Path (Paddle)
                doc = fitz.open(req.file_path)
                target_indices = range(len(doc)) if candidate_pages == "all" else [p-1 for p in candidate_pages]
                for idx in target_indices:
                    page = doc[idx]
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.wid, pix.n)
                    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR) if pix.n == 3 else cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
                    result_tables.extend(process_paddle_tables(img_bgr, idx + 1, document_id, len(result_tables)))
                doc.close()

                if not result_tables:
                    fallback_required = True
                    fallback_reason = "paddle_zero_results"

            # --- PHASE 3: Docling Fallback Escalation ---
            if fallback_required:
                logger.info(f'{{"event": "triggering_docling", "reason": "{fallback_reason}"}}')
                docling_results = await process_docling_fallback(req.file_path, document_id)
                if docling_results:
                    result_tables = docling_results # Prioritize Docling results if triggered

            duration = time.time() - start_time
            logger.info(f'{{"event": "table_extraction_success", "tables_found": {len(result_tables)}, "total_duration_ms": {round(duration * 1000)}}}')
            
            return {
                "success": True,
                "tables": result_tables,
                "excelFiles": [t["excelPath"] for t in result_tables]
            }
            
        except Exception as e:
            logger.error(f'{{"event": "table_extraction_error", "error": "{str(e)}"}}')
            return {"success": False, "error": str(e), "tables": []}

@app.post("/ocr")
async def process_ocr(req: OCRRequest):
    async with ocr_semaphore:
        try:
            result = perform_ocr(ocr_instance, req.file_path)
            return result
        except Exception as e:
            return {"text": "", "confidence": 0, "angle": 0, "orientationConfidence": 0, "error": str(e)}
