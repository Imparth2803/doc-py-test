from fastapi import FastAPI
from pydantic import BaseModel
import logging
import os
import time
import datetime
import asyncio

import camelot
import pdfplumber
import pandas as pd

# ----------------------------------
# Logging Setup
# ----------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PureCamelotTableServer")

app = FastAPI(title="Smart Document Vault Pure Camelot Extraction Service")

# ----------------------------------
# Configuration
# ----------------------------------

table_semaphore = asyncio.Semaphore(1)

TABLES_DIR = os.path.join(os.getcwd(), "uploads", "tables")
os.makedirs(TABLES_DIR, exist_ok=True)

MIN_TABLE_CONFIDENCE = 0.65

# ----------------------------------
# Models
# ----------------------------------

class TableRequest(BaseModel):
    file_path: str
    strategy: str = "DIGITAL_DOCUMENT"

# ----------------------------------
# Excel Formatting Helpers
# ----------------------------------

def get_excel_column_name(col_idx):
    name = ""
    while col_idx >= 0:
        name = chr(col_idx % 26 + 65) + name
        col_idx = col_idx // 26 - 1
    return name

def elevate_dataframe_headers(df):
    if df.shape[0] > 0:
        raw_headers = df.iloc[0].tolist()
        clean_headers = []
        for i, h in enumerate(raw_headers):
            h_str = str(h).strip().replace("\n", " ")
            if not h_str or h_str.lower() == 'nan':
                h_str = f"Column_{get_excel_column_name(i)}"
            clean_headers.append(h_str)
            
        df.columns = clean_headers
        df = df.iloc[1:].reset_index(drop=True)
    return df

def merge_multi_row_headers(df):
    if df.shape[0] >= 2:
        row0 = df.iloc[0].tolist()
        row1 = df.iloc[1].tolist()
        
        is_row1_header = True
        for val in row1:
            if val is not None and str(val).strip():
                val_str = str(val).strip().replace(".", "").replace(",", "").replace("-", "")
                if val_str.isdigit():
                    is_row1_header = False
                    break
                    
        if is_row1_header:
            merged_headers = []
            for col_idx in range(len(row0)):
                h0 = str(row0[col_idx]).strip().replace("\n", " ") if row0[col_idx] is not None else ""
                h1 = str(row1[col_idx]).strip().replace("\n", " ") if row1[col_idx] is not None else ""
                
                if h0.lower() == 'nan':
                    h0 = ""
                if h1.lower() == 'nan':
                    h1 = ""
                    
                if h0 and h1 and h0 != h1:
                    merged = f"{h0} {h1}"
                else:
                    merged = h0 or h1
                    
                if not merged:
                    merged = f"Column_{get_excel_column_name(col_idx)}"
                merged_headers.append(merged)
                
            df.columns = merged_headers
            df = df.iloc[2:].reset_index(drop=True)
            return df
            
    return elevate_dataframe_headers(df)

# ----------------------------------
# Extraction Quality Estimator
# ----------------------------------


def evaluate_camelot_quality(t, df):
    accuracy = getattr(t, "accuracy", 100) / 100
    total_cells = df.size
    empty_cells = df.isna().sum().sum() + (df == "").sum().sum()
    empty_ratio = empty_cells / total_cells if total_cells > 0 else 0.0
    
    score = accuracy - (0.4 * empty_ratio)
    return round(max(0.1, min(1.0, score)), 4)

# ----------------------------------
# Candidate Page Detection
# ----------------------------------

def detect_table_pages_digital(file_path: str):
    candidate_pages = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                has_tables = bool(page.find_tables())
                has_lines = (
                    hasattr(page, "horizontal_edges")
                    and len(page.horizontal_edges) > 5
                )
                if has_tables or has_lines or len(page.extract_words()) > 10:
                    candidate_pages.append(i + 1)
    except Exception as e:
        logger.error(f"Page detection failed: {e}")
        return "all"
    return candidate_pages if candidate_pages else [1]

# ----------------------------------
# Health API
# ----------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "camelot-table-extraction-service",
        "engine": "camelot-lattice-stream-fallback"
    }

# ----------------------------------
# API Extract Tables (Pure Camelot)
# ----------------------------------

@app.post("/extract-tables")
async def extract_tables(req: TableRequest):
    document_id = os.path.basename(req.file_path).replace(".", "_")
    
    async with table_semaphore:
        start_time = time.time()
        
        try:
            if req.strategy != "DIGITAL_DOCUMENT":
                logger.info(f"[TABLES] Scanned strategy bypassed: {req.file_path}")
                return {
                    "success": True,
                    "tables": [],
                    "workbookPath": None,
                    "workbookName": None,
                    "sheetCount": 0,
                    "totalTables": 0,
                    "pagesWithTables": []
                }

            candidate_pages = detect_table_pages_digital(req.file_path)
            
            doc_table_dir = os.path.join(TABLES_DIR, document_id)
            os.makedirs(doc_table_dir, exist_ok=True)

            for f in os.listdir(doc_table_dir):
                fp = os.path.join(doc_table_dir, f)
                if os.path.isfile(fp):
                    try:
                        os.remove(fp)
                    except Exception as e:
                        logger.error(f"Failed to delete old file {fp}: {e}")

            workbook_name = f"{document_id}_Tables.xlsx"
            workbook_path = os.path.join(doc_table_dir, workbook_name)

            all_extracted_regions = []
            tables_count = 0
            kv_count = 0
            global_reading_order = 0

            with pdfplumber.open(req.file_path) as pdf:
                with pd.ExcelWriter(workbook_path, engine="openpyxl") as writer:
                    
                    for page_num in candidate_pages:
                        if page_num > len(pdf.pages):
                            continue
                        
                        page = pdf.pages[page_num - 1]
                        all_words = page.extract_words()
                        if not all_words:
                            continue
                            
                        # Run Camelot Page-Wide (Phase 1)
                        detected_tables = []
                        try:
                            tables = camelot.read_pdf(req.file_path, pages=str(page_num), flavor="lattice")
                            if len(tables) == 0:
                                plumber_tables = page.find_tables()
                                if plumber_tables and len(plumber_tables) > 0:
                                    tables = camelot.read_pdf(
                                        req.file_path, pages=str(page_num),
                                        flavor="stream", edge_tol=50, row_tol=10
                                    )
                            detected_tables = [t for t in tables if t.df is not None and not t.df.empty]
                        except Exception as camelot_err:
                            logger.warning(f"Camelot failed on page {page_num}: {camelot_err}")

                        page_regions = []
                        for t_idx, t in enumerate(detected_tables):
                            x0, y0, x1, y1 = t._bbox
                            pdf_y0 = page.height - y1
                            pdf_y1 = page.height - y0

                            elevated_df = merge_multi_row_headers(t.df.copy())
                            t_quality = evaluate_camelot_quality(t, elevated_df)

                            if t_quality < MIN_TABLE_CONFIDENCE:
                                logger.info(
                                    f"\n[TABLE FILTER]\n\n"
                                    f"Page: {page_num}\n\n"
                                    f"Table Index: {t_idx}\n\n"
                                    f"Engine: camelot-{getattr(t, 'flavor', 'lattice')}\n\n"
                                    f"Confidence: {t_quality}\n\n"
                                    f"Threshold: 0.65\n\n"
                                    f"Reason:\n"
                                    f"Dropped because confidence is below minimum threshold.\n"
                                    f"----------------------------------------\n"
                                )
                                continue

                            headers = elevated_df.columns.tolist()

                            grid_items = []
                            for _, row_vals in elevated_df.iterrows():
                                row_dict = {}
                                for col_idx, h in enumerate(headers):
                                    cell_val = row_vals.iloc[col_idx]
                                    row_dict[h] = str(cell_val).strip() if cell_val is not None and str(cell_val).strip().lower() != 'nan' else ""
                                grid_items.append(row_dict)

                            page_regions.append({
                                "regionType": "TABLE",
                                "boundingBox": {
                                    "x": round(x0, 2),
                                    "y": round(pdf_y0, 2),
                                    "width": round(x1 - x0, 2),
                                    "height": round(pdf_y1 - pdf_y0, 2)
                                },
                                "top": pdf_y0,
                                "x0": x0,
                                "confidence": t_quality,
                                "engine": "camelot-" + getattr(t, "flavor", "lattice"),
                                "df": elevated_df,
                                "rawText": "",
                                "layoutConfidence": 1.0,
                                "extractionConfidence": t_quality,
                                "extractionEngine": "camelot-" + getattr(t, "flavor", "lattice"),
                                "layoutEvidence": {
                                    "tableEvidence": 1.0,
                                    "keyValueEvidence": 0.0,
                                    "reasons": ["Camelot table extraction."]
                                },
                                "grid_items": grid_items,
                                "table_metadata": {}
                            })
                            
                        def compare_regions(r1, r2):
                            if abs(r1["top"] - r2["top"]) < 25.0:
                                return -1 if r1["x0"] < r2["x0"] else 1
                            return -1 if r1["top"] < r2["top"] else 1

                        from functools import cmp_to_key
                        sorted_page_regions = sorted(page_regions, key=cmp_to_key(compare_regions))
                        
                        for reg in sorted_page_regions:
                            global_reading_order += 1
                            region_type = reg["regionType"]
                            sheet_df = reg["df"]
                            
                            if region_type == "TABLE":
                                tables_count += 1
                                sheet_name = f"Page_{page_num}_Table_{tables_count}"
                            else:
                                kv_count += 1
                                sheet_name = f"Page_{page_num}_KeyValue_{kv_count}"
                                
                            if len(sheet_name) > 31:
                                sheet_name = sheet_name[:31]
                                
                            metadata = [
                                ["Metadata", ""],
                                ["PDF Name", os.path.basename(req.file_path)],
                                ["Page Number", page_num],
                                ["Region Type", region_type],
                                ["Bounding Box", f"{reg['boundingBox']['x']},{reg['boundingBox']['y']},{reg['boundingBox']['width']},{reg['boundingBox']['height']}"],
                                ["Extraction Engine", reg["engine"]],
                                ["Confidence", reg["confidence"]],
                                ["Extraction Timestamp", datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")]
                            ]
                            
                            meta_df = pd.DataFrame(metadata)
                            meta_df.to_excel(writer, sheet_name=sheet_name, index=False, header=False, startrow=0)
                            sheet_df.to_excel(writer, sheet_name=sheet_name, index=False, header=True, startrow=9)
                            
                            all_extracted_regions.append({
                                "page": page_num,
                                "sheetName": sheet_name,
                                "regionType": region_type,
                                "boundingBox": reg["boundingBox"],
                                "confidence": reg["confidence"],
                                "engine": reg["engine"],
                                "rowCount": sheet_df.shape[0],
                                "colCount": sheet_df.shape[1] if region_type == "TABLE" else 2,
                                "fallbackUsed": False,
                                "readingOrder": global_reading_order,
                                "rawText": reg["rawText"],
                                "grid_items": reg.get("grid_items", []),
                                "table_metadata": reg.get("table_metadata", {}),
                                # Keep layout metrics
                                "layoutConfidence": reg.get("layoutConfidence", 1.0),
                                "extractionConfidence": reg.get("extractionConfidence", 1.0),
                                "extractionEngine": reg.get("extractionEngine", "camelot"),
                                "layoutEvidence": reg.get("layoutEvidence", {"tableEvidence": 1.0, "keyValueEvidence": 0.0, "reasons": []})
                            })

            if len(all_extracted_regions) == 0:
                logger.info("[TABLES] No visual regions successfully extracted.")
                return {
                    "success": True,
                    "tables": [],
                    "workbookPath": None,
                    "workbookName": None,
                    "sheetCount": 0,
                    "totalTables": 0,
                    "pagesWithTables": []
                }

            pages = list(set([r["page"] for r in all_extracted_regions]))
            relative_wb_path = f"/uploads/tables/{document_id}/{workbook_name}"
            duration_ms = round((time.time() - start_time) * 1000)
            
            logger.info(f"[TABLES] Pure Camelot extraction finished: {len(all_extracted_regions)} regions in {duration_ms}ms")
            
            return {
                "success": True,
                "workbookPath": relative_wb_path,
                "workbookName": workbook_name,
                "sheetCount": len(all_extracted_regions),
                "totalTables": len(all_extracted_regions),
                "pagesWithTables": pages,
                "extractedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "previewAvailable": True,
                "tables": all_extracted_regions
            }

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"[TABLES] Pure Camelot extraction pipeline failed\n{tb}")
            return {
                "success": False,
                "error": str(e)
            }