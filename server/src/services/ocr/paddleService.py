import sys
from src.services.ocr.ocr_core import get_ocr_instance, perform_ocr
import json

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "hi"

    # For legacy script, we still have to load the model every time
    ocr_instance = get_ocr_instance(language=language)
    result = perform_ocr(ocr_instance, file_path)
    print(json.dumps(result))
