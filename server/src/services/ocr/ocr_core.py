from paddleocr import PaddleOCR
import json
import traceback
import logging

logger = logging.getLogger("OCRCore")

def get_ocr_instance(language="hi"):
    """
    Initializes and returns a PaddleOCR instance.
    """
    return PaddleOCR(
        use_textline_orientation=True,
        lang=language
    )

def perform_ocr(ocr_instance: PaddleOCR, file_path: str):
    """
    Executes OCR on a file using a provided instance and returns structured results.
    This logic is shared between the legacy script and the FastAPI server.
    """
    try:
        result = ocr_instance.ocr(file_path)

        if not result or result[0] is None:
            return {
                "text": "",
                "confidence": 0,
                "angle": 0,
                "orientationConfidence": 0
            }

        page = result[0]

        # Handle both list of tuples and dict format
        if isinstance(page, dict):
            texts = page.get("rec_texts", [])
            scores = page.get("rec_scores", [])
            preprocessor_res = page.get("doc_preprocessor_res", {})
            angle = preprocessor_res.get("angle", 0)
            orientation_confidence = preprocessor_res.get("score", 0)
        else:
            texts = [line[1][0] for line in page]
            scores = [line[1][1] for line in page]
            angle = 0
            orientation_confidence = 0

        full_text = "\n".join(texts)

        avg_confidence = (
            sum(scores) / len(scores)
            if scores
            else 0
        )

        return {
            "text": full_text,
            "confidence": round(avg_confidence * 100, 2),
            "angle": angle,
            "orientationConfidence": orientation_confidence
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
