import easyocr
import os
import json
import traceback
import logging
import time
import gc
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image

# Monkey patch EasyOCR Reader to handle 'gu' by internally using 'hi' and 'en' for detection,
# since EasyOCR does not support Gujarati ('gu') natively.
_original_reader_init = easyocr.Reader.__init__
def _patched_reader_init(self, lang_list, *args, **kwargs):
    safe_lang_list = [lang for lang in lang_list if lang != 'gu']
    if not safe_lang_list:
        safe_lang_list = ['en']
    _original_reader_init(self, safe_lang_list, *args, **kwargs)
easyocr.Reader.__init__ = _patched_reader_init

logger = logging.getLogger("OCRCore")

# Global TrOCR Cache schema to hold a single model at a time in memory
trocr_cache = {
    "model":     None,
    "processor": None,
    "language":  None   # "english" | "hindi" | None
}

def switch_trocr_model(required_language: str):
    """
    Loads the required TrOCR model and unloads the other if present.
    Never holds both models in memory simultaneously.
    """
    if trocr_cache["language"] == required_language:
        # Already loaded — nothing to do
        return trocr_cache["model"], trocr_cache["processor"]

    # Unload current model if different one is loaded
    if trocr_cache["model"] is not None:
        print(f"[TrOCR] Unloading {trocr_cache['language']} model")
        del trocr_cache["model"]
        del trocr_cache["processor"]
        trocr_cache["model"]     = None
        trocr_cache["processor"] = None
        trocr_cache["language"]  = None
        gc.collect()
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()   # free MPS memory on Mac
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()

    # Load required model
    model_id = {
        "english": "microsoft/trocr-large-handwritten",
        "hindi":   "ai4bharat/indic-trocr-handwritten-hindi",
    }[required_language]

    print(f"[TrOCR] Loading {required_language} model: {model_id}")
    device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    
    trocr_cache["processor"] = TrOCRProcessor.from_pretrained(model_id)
    model = VisionEncoderDecoderModel.from_pretrained(model_id).to(device)
    trocr_cache["model"]     = model
    trocr_cache["language"]  = required_language

    return trocr_cache["model"], trocr_cache["processor"]

def get_ocr_instance(language="en"):
    """
    Initializes and returns the appropriate OCR engine wrapper or instance.
    Confirm detection reader explicitly initializes as easyocr.Reader(['en', 'hi', 'gu'], gpu=True)
    """
    logger.info("[OCR] Initializing EasyOCR Reader for ['en', 'hi', 'gu']...")
    return easyocr.Reader(['en', 'hi', 'gu'], gpu=False)

def perform_trocr_inference(file_path: str, first_pass_results: list, language: str, request_id: str = "N/A"):
    """
    Runs line-level cropped TrOCR batch inference on detected bounding boxes,
    maintaining geometric alignment and calculating the average bbox confidence.
    """
    try:
        # 1. Load the active TrOCR model (English or Hindi)
        target_lang = "hindi" if language == "hi" else "english"
        model, processor = switch_trocr_model(target_lang)
        device = next(model.parameters()).device

        # 2. Extract crops based on first-pass EasyOCR coordinates
        pil_image = Image.open(file_path).convert("RGB")
        crop_images = []
        
        for line in first_pass_results:
            box = line[0]
            # Ensure coordinates are bounded to PIL image boundaries
            min_x = max(0, int(min(p[0] for p in box)))
            max_x = min(pil_image.width, int(max(p[0] for p in box)))
            min_y = max(0, int(min(p[1] for p in box)))
            max_y = min(pil_image.height, int(max(p[1] for p in box)))
            
            # Avoid empty crop dimensions
            if max_x > min_x and max_y > min_y:
                crop_img = pil_image.crop((min_x, min_y, max_x, max_y))
                crop_images.append(crop_img)
            else:
                # Add a dummy 1x1 crop to preserve index alignment
                crop_images.append(Image.new("RGB", (1, 1), color="white"))

        if not crop_images:
            return {
                "text": "",
                "confidence": 0.0,
                "angle": 0,
                "orientationConfidence": 1.0
            }

        # 3. Batch preprocess and perform TrOCR inference
        pixel_values = processor(images=crop_images, return_tensors="pt").pixel_values.to(device)
        with torch.no_grad():
            generated_ids = model.generate(pixel_values)
        
        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)

        # 4. Geometrically reconstruct full-page layout
        lines = []
        scores = []
        for i, line in enumerate(first_pass_results):
            box = line[0]
            trocr_text = generated_text[i].strip()
            score = line[2]
            scores.append(score)
            
            y_center = (box[0][1] + box[2][1]) / 2
            x_center = (box[0][0] + box[2][0]) / 2
            lines.append((y_center, x_center, trocr_text, score))

        # Sort top-to-bottom, then left-to-right
        Y_TOLERANCE = 15
        lines.sort(key=lambda item: item[0])
        
        grouped_lines = []
        if lines:
            current_group = [lines[0]]
            for i in range(1, len(lines)):
                if abs(lines[i][0] - current_group[0][0]) <= Y_TOLERANCE:
                    current_group.append(lines[i])
                else:
                    current_group.sort(key=lambda item: item[1])
                    grouped_lines.extend(current_group)
                    current_group = [lines[i]]
            if current_group:
                current_group.sort(key=lambda item: item[1])
                grouped_lines.extend(current_group)

        reconstructed_text = []
        if grouped_lines:
            current_row_text = [grouped_lines[0][2]]
            for i in range(1, len(grouped_lines)):
                if abs(grouped_lines[i][0] - grouped_lines[i-1][0]) <= Y_TOLERANCE:
                    current_row_text.append(grouped_lines[i][2])
                else:
                    reconstructed_text.append(" ".join(current_row_text))
                    current_row_text = [grouped_lines[i][2]]
            if current_row_text:
                reconstructed_text.append(" ".join(current_row_text))

        full_text = "\n".join(reconstructed_text)

        # Option A: Average of EasyOCR detection bbox confidence scores from first-pass
        avg_confidence = (sum(scores) / len(scores)) if scores else 0.0
        avg_confidence_pct = round(avg_confidence * 100, 2)

        return {
            "text": full_text.strip(),
            "confidence": avg_confidence_pct,
            "angle": 0,
            "orientationConfidence": 1.0
        }
    except Exception as e:
        print(f"[TrOCR] Inference error request_id={request_id}: {str(e)}")
        return {
            "text": "",
            "confidence": 0.0,
            "angle": 0,
            "orientationConfidence": 1.0,
            "error": str(e)
        }

def perform_ocr(ocr_instance, file_path: str, request_id: str = "N/A"):
    """
    Executes OCR on a file using the provided instance/config and returns structured results.
    Used for EasyOCR full-page fallback (e.g. Gujarati).
    """
    try:
        logger.info(f"[OCR] OCR_INFERENCE_START request_id={request_id}")
        print(f"[OCR] OCR_INFERENCE_START request_id={request_id}", flush=True)
        start_inf = time.time()
        
        # EasyOCR Reader execution
        results = ocr_instance.readtext(file_path)
        duration_inf_ms = (time.time() - start_inf) * 1000
        logger.info(f"[OCR] OCR_INFERENCE_END request_id={request_id} duration_ms={duration_inf_ms:.2f}")
        print(f"[OCR] OCR_INFERENCE_END request_id={request_id} duration_ms={duration_inf_ms:.2f}", flush=True)
        
        if not results:
            return {
                "text": "",
                "confidence": 0,
                "angle": 0,
                "orientationConfidence": 0
            }
        
        logger.info(f"[OCR] OCR_POSTPROCESS_START request_id={request_id}")
        print(f"[OCR] OCR_POSTPROCESS_START request_id={request_id}", flush=True)
        start_post = time.time()
        
        # results is a list of [box, text, score]
        lines = []
        scores = []
        for line in results:
            box = line[0]
            text = line[1]
            score = line[2]
            scores.append(score)
            
            # Calculate center coordinates for sorting
            y_center = (box[0][1] + box[2][1]) / 2
            x_center = (box[0][0] + box[2][0]) / 2
            lines.append((y_center, x_center, text, score))
            
        # Sort geometrically: Top-to-Bottom, Left-to-Right
        Y_TOLERANCE = 15 
        lines.sort(key=lambda item: item[0]) # Initial sort by Y
        
        # Group by Y and sort by X
        grouped_lines = []
        if lines:
            current_group = [lines[0]]
            for i in range(1, len(lines)):
                if abs(lines[i][0] - current_group[0][0]) <= Y_TOLERANCE:
                    current_group.append(lines[i])
                else:
                    current_group.sort(key=lambda item: item[1]) # Sort group by X
                    grouped_lines.extend(current_group)
                    current_group = [lines[i]]
            if current_group:
                current_group.sort(key=lambda item: item[1])
                grouped_lines.extend(current_group)
        
        # Reconstruct text line-by-line
        reconstructed_text = []
        if grouped_lines:
            current_row_text = [grouped_lines[0][2]]
            for i in range(1, len(grouped_lines)):
                if abs(grouped_lines[i][0] - grouped_lines[i-1][0]) <= Y_TOLERANCE:
                    current_row_text.append(grouped_lines[i][2])
                else:
                    reconstructed_text.append(" ".join(current_row_text))
                    current_row_text = [grouped_lines[i][2]]
            if current_row_text:
                reconstructed_text.append(" ".join(current_row_text))
        
        full_text = "\n".join(reconstructed_text)
        
        duration_post_ms = (time.time() - start_post) * 1000
        logger.info(f"[OCR] OCR_POSTPROCESS_END request_id={request_id} duration_ms={duration_post_ms:.2f}")
        print(f"[OCR] OCR_POSTPROCESS_END request_id={request_id} duration_ms={duration_post_ms:.2f}", flush=True)
        
        avg_confidence = (sum(scores) / len(scores)) if scores else 0
        
        return {
            "text": full_text.strip(),
            "confidence": round(avg_confidence * 100, 2),
            "angle": 0,
            "orientationConfidence": 1.0
        }
            
    except Exception as e:
        logger.error(f"Core OCR Error: {str(e)}\n{traceback.format_exc()}")
        return {
            "text": "",
            "confidence": 0,
            "angle": 0,
            "orientationConfidence": 0,
            "error": str(e)
        }
