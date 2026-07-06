import sys
import os
import time

# Add root directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.services.ocr.ocr_core import get_ocr_instance, perform_ocr

def test_language(lang_code, name):
    print(f"\n==========================================")
    print(f"Testing Engine for {name} ({lang_code})")
    print(f"==========================================")
    
    start_load = time.time()
    instance = get_ocr_instance(language=lang_code)
    print(f"Model/config loaded in {time.time() - start_load:.2f}s")
    
    image_path = "uploads/1781083613075-BankStatementChequing.png"
    if not os.path.exists(image_path):
        print(f"Image not found at {image_path}")
        return
        
    print(f"Running OCR inference on {image_path}...")
    start_inf = time.time()
    try:
        result = perform_ocr(instance, image_path, request_id="TEST_RUN")
        print(f"OCR finished in {time.time() - start_inf:.2f}s")
        print(f"Confidence: {result.get('confidence')}%")
        print(f"Text Preview (first 150 chars):\n{result.get('text', '')[:150]}...")
        if "error" in result:
            print("ERROR IN RESULT:", result["error"])
    except Exception as e:
        print("EXCEPTION OCCURRED:", e)

if __name__ == "__main__":
    # Test English EasyOCR
    test_language("en", "English (EasyOCR)")
    
    # Test Hindi EasyOCR
    test_language("hi", "Hindi (EasyOCR)")
    
    # Test Gujarati Tesseract
    test_language("gu", "Gujarati (Tesseract)")
