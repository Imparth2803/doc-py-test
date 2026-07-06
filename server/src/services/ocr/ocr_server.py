from fastapi import FastAPI, Request
from pydantic import BaseModel
import logging
import time
import asyncio
import os
import uuid
import gc
import threading
import cv2
import re
import torch
import numpy as np
from datetime import datetime, timedelta
from src.services.ocr.ocr_core import get_ocr_instance, perform_ocr, perform_trocr_inference, trocr_cache

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "name": "%(name)s", "level": "%(levelname)s", "message": %(message)s}'
)
logger = logging.getLogger("OCRServer")

app = FastAPI(title="Smart Document Vault OCR Service")

# Concurrency Control
ocr_semaphore = asyncio.Semaphore(1)

# Idle Unload Configuration
OCR_IDLE_UNLOAD_MINUTES = int(os.getenv("OCR_IDLE_UNLOAD_MINUTES", "15"))
last_request_time = datetime.now()
ocr_instances = {}
model_lock = threading.Lock()

def get_ocr_model(language: str = "en", request_id: str = "N/A"):
    global ocr_instances, last_request_time
    with model_lock:
        last_request_time = datetime.now()
        key = "detector"
        if key not in ocr_instances:
            logger.info(f"[OCR] OCR_MODEL_LOAD_START request_id={request_id} language={key}")
            print(f"[OCR] OCR_MODEL_LOAD_START request_id={request_id} language={key}", flush=True)
            start_load = time.time()
            ocr_instances[key] = get_ocr_instance(language="en")
            duration_ms = (time.time() - start_load) * 1000
            logger.info(f"[OCR] OCR_MODEL_LOAD_END request_id={request_id} language={key} duration_ms={duration_ms:.2f}")
            print(f"[OCR] OCR_MODEL_LOAD_END request_id={request_id} language={key} duration_ms={duration_ms:.2f}", flush=True)
        return ocr_instances[key]

def unload_models_if_idle():
    global ocr_instances
    logger.info(f"[OCR] Idle unload monitor started (Timeout: {OCR_IDLE_UNLOAD_MINUTES}m)")
    while True:
        time.sleep(60) # Check every minute
        with model_lock:
            if ocr_instances or trocr_cache["model"] is not None:
                idle_duration = datetime.now() - last_request_time
                if idle_duration > timedelta(minutes=OCR_IDLE_UNLOAD_MINUTES):
                    logger.info(f"[OCR] Models and TrOCR cache unloaded due to inactivity ({OCR_IDLE_UNLOAD_MINUTES}m)")
                    ocr_instances.clear()
                    trocr_cache["model"]     = None
                    trocr_cache["processor"] = None
                    trocr_cache["language"]  = None
                    gc.collect()
                    if torch.backends.mps.is_available():
                        torch.mps.empty_cache()
                    elif torch.cuda.is_available():
                        torch.cuda.empty_cache()

# Start idle monitor thread
threading.Thread(target=unload_models_if_idle, daemon=True).start()

class OCRRequest(BaseModel):
    file_path: str
    language: str = "en"

def enhance_document_image(file_path: str) -> str:
    # 1. Load the image matrix in grayscale
    img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Could not read image from {file_path}")
    
    # 2. Add a uniform 60-pixel white border padding
    img_padded = cv2.copyMakeBorder(
        img, 60, 60, 60, 60, 
        borderType=cv2.BORDER_CONSTANT, 
        value=255
    )
    
    # 3. Apply local illumination and shadow correction using CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    img_clahe = clahe.apply(img_padded)
    
    # 4. Filter background paper grain and wrinkles using a text-edge preserving Bilateral Filter
    img_bilateral = cv2.bilateralFilter(img_clahe, 9, 75, 75)
    
    # 5. Convert the image into a clean, binary black-and-white mask using adaptive thresholding
    img_thresh = cv2.adaptiveThreshold(
        img_bilateral, 255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 11, 2
    )
    
    # 6. Fuse broken or faded text lines using a small 2x2 rectangular kernel with Morphological Closing
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    img_closed = cv2.morphologyEx(img_thresh, cv2.MORPH_CLOSE, kernel)
    
    # 7. Save the polished matrix to a temporary file path and return it
    temp_dir = os.path.dirname(file_path)
    file_name = os.path.basename(file_path)
    temp_file_path = os.path.join(temp_dir, f"enhanced_{uuid.uuid4().hex}_{file_name}")
    cv2.imwrite(temp_file_path, img_closed)
    
    return temp_file_path

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ocr-service", "model_loaded": (len(ocr_instances) > 0 or trocr_cache["model"] is not None)}

@app.post("/ocr")
@app.post("/extract_text")
async def process_ocr(req: OCRRequest):
    request_id = uuid.uuid4().hex
    start_time = time.time()
    timestamp_str = datetime.now().isoformat()
    
    logger.info(f"[OCR] OCR_REQUEST_START request_id={request_id} file_path={req.file_path} language={req.language} timestamp={timestamp_str}")
    print(f"[OCR] OCR_REQUEST_START request_id={request_id} file_path={req.file_path} language={req.language} timestamp={timestamp_str}", flush=True)
    
    try:
        async with ocr_semaphore:
            wait_time_ms = (time.time() - start_time) * 1000
            logger.info(f"[OCR] OCR_SEMAPHORE_ACQUIRED request_id={request_id} wait_time_ms={wait_time_ms:.2f}")
            print(f"[OCR] OCR_SEMAPHORE_ACQUIRED request_id={request_id} wait_time_ms={wait_time_ms:.2f}", flush=True)
            
            instance = await asyncio.to_thread(get_ocr_model, req.language, request_id)
            
            # EasyOCR detection pass (runs script identification & returns coordinates)
            first_pass_results = await asyncio.to_thread(instance.readtext, req.file_path)
            raw_text = " ".join([line[1] for line in first_pass_results])
            
            # Calculate character counts for percentage script routing
            latin_chars = len(re.findall(r'[a-zA-Z]', raw_text))
            devanagari_chars = len(re.findall(r'[\u0900-\u097F]', raw_text))
            gujarati_chars = len(re.findall(r'[\u0A80-\u0AFF]', raw_text))
            total_detected_chars = latin_chars + devanagari_chars + gujarati_chars

            latin_pct = latin_chars / total_detected_chars if total_detected_chars > 0 else 0
            devanagari_pct = devanagari_chars / total_detected_chars if total_detected_chars > 0 else 0
            gujarati_pct = gujarati_chars / total_detected_chars if total_detected_chars > 0 else 0

            if total_detected_chars > 0:
                if gujarati_pct > 0.15:
                    detected_lang = "gu"
                elif devanagari_pct > 0.15:
                    detected_lang = "hi"
                elif latin_pct > 0.15:
                    detected_lang = "en"
                else:
                    detected_lang = "en"
            else:
                detected_lang = req.language if req.language in ("hi", "gu") else "en"

            logger.info(f"[OCR] Script Detection: total_chars={total_detected_chars} gu_pct={gujarati_pct:.2f} hi_pct={devanagari_pct:.2f} en_pct={latin_pct:.2f} -> Routed language={detected_lang}")
            
            # 1. Low quality image logic
            if len(raw_text) < 150:
                logger.info(f"[OCR] Document is low-quality/blurry (length: {len(raw_text)} < 150). Triggering enhance_document_image...")
                print(f"[OCR] Document is low-quality/blurry (length: {len(raw_text)} < 150). Triggering enhance_document_image...", flush=True)
                
                # Image enhancement step
                enhanced_path = await asyncio.to_thread(enhance_document_image, req.file_path)
                
                try:
                    # Re-run detection on enhanced image
                    first_pass_results = await asyncio.to_thread(instance.readtext, enhanced_path)
                    raw_text = " ".join([line[1] for line in first_pass_results])
                    
                    # Re-run script detection on enhanced text
                    latin_chars = len(re.findall(r'[a-zA-Z]', raw_text))
                    devanagari_chars = len(re.findall(r'[\u0900-\u097F]', raw_text))
                    gujarati_chars = len(re.findall(r'[\u0A80-\u0AFF]', raw_text))
                    total_detected_chars = latin_chars + devanagari_chars + gujarati_chars
                    
                    latin_pct = latin_chars / total_detected_chars if total_detected_chars > 0 else 0
                    devanagari_pct = devanagari_chars / total_detected_chars if total_detected_chars > 0 else 0
                    gujarati_pct = gujarati_chars / total_detected_chars if total_detected_chars > 0 else 0

                    if total_detected_chars > 0:
                        if gujarati_pct > 0.15:
                            detected_lang = "gu"
                        elif devanagari_pct > 0.15:
                            detected_lang = "hi"
                        elif latin_pct > 0.15:
                            detected_lang = "en"
                        else:
                            detected_lang = "en"
                    else:
                        detected_lang = req.language if req.language in ("hi", "gu") else "en"

                    # Run OCR logic on enhanced image path
                    if detected_lang == "gu":
                        result = await asyncio.to_thread(perform_ocr, instance, enhanced_path, request_id)
                    else:
                        result = await asyncio.to_thread(perform_trocr_inference, enhanced_path, first_pass_results, detected_lang, request_id)
                finally:
                    # Clean up temporary enhanced file from disk
                    if os.path.exists(enhanced_path):
                        try:
                            os.remove(enhanced_path)
                        except Exception as cleanup_err:
                            logger.error(f"[OCR] Failed to remove temporary enhanced file {enhanced_path}: {cleanup_err}")
            else:
                # 2. Document is high quality, bypass enhancement
                if detected_lang == "gu":
                    result = await asyncio.to_thread(perform_ocr, instance, req.file_path, request_id)
                else:
                    result = await asyncio.to_thread(perform_trocr_inference, req.file_path, first_pass_results, detected_lang, request_id)
            
            if "error" in result:
                elapsed_time_ms = (time.time() - start_time) * 1000
                logger.error(f"[OCR] OCR_REQUEST_FAILED request_id={request_id} exception={result['error']} elapsed_time_ms={elapsed_time_ms:.2f}")
                print(f"[OCR] OCR_REQUEST_FAILED request_id={request_id} exception={result['error']} elapsed_time_ms={elapsed_time_ms:.2f}", flush=True)
                return result
                
            total_duration_ms = (time.time() - start_time) * 1000
            text_length = len(result.get("text", ""))
            confidence = result.get("confidence", 0)
            
            logger.info(f"[OCR] OCR_RESPONSE_SENT request_id={request_id} total_duration_ms={total_duration_ms:.2f} text_length={text_length} confidence={confidence}")
            print(f"[OCR] OCR_RESPONSE_SENT request_id={request_id} total_duration_ms={total_duration_ms:.2f} text_length={text_length} confidence={confidence}", flush=True)
            return result
    except Exception as e:
        elapsed_time_ms = (time.time() - start_time) * 1000
        logger.error(f"[OCR] OCR_REQUEST_FAILED request_id={request_id} exception={str(e)} elapsed_time_ms={elapsed_time_ms:.2f}")
        print(f"[OCR] OCR_REQUEST_FAILED request_id={request_id} exception={str(e)} elapsed_time_ms={elapsed_time_ms:.2f}", flush=True)
        return {"text": "", "confidence": 0, "angle": 0, "orientationConfidence": 0, "error": str(e)}
