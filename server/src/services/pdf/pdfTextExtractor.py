import fitz
import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing file path argument"}))
        sys.exit(0)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File does not exist: {file_path}"}))
        sys.exit(0)

    try:
        doc = fitz.open(file_path)
        page_count = doc.page_count
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        
        full_text = "".join(text_parts)
        print(json.dumps({
            "success": True,
            "pageCount": page_count,
            "textLength": len(full_text),
            "text": full_text
        }))
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == "__main__":
    main()
