import sys
import importlib
import platform

# validate_ocr_environment.py
# Environment Validation Suite for OCR Subsystem

def check_python_version():
    print(f"[*] Python Version: {sys.version.split()[0]}")
    if sys.version_info.major != 3 or sys.version_info.minor != 11:
        print("FAIL: Python 3.11 is required.")
        return False
    return True

def check_import(module_name, attribute=None):
    try:
        module = importlib.import_module(module_name)
        if attribute:
            getattr(module, attribute)
        print(f"PASS: {module_name} is importable.")
        return True
    except (ImportError, AttributeError) as e:
        print(f"FAIL: {module_name} error: {e}")
        return False

def check_package_version(package_name, expected_version):
    try:
        from importlib.metadata import version
        actual_version = version(package_name)
        print(f"[*] {package_name} Version: {actual_version}")
        if expected_version and actual_version != expected_version:
             # For some packages we just want to ensure they aren't a major version ahead
             if package_name == "paddleocr" and actual_version.startswith("3."):
                 print(f"FAIL: {package_name} {actual_version} is incompatible (Requires 2.x)")
                 return False
        return True
    except Exception:
        print(f"FAIL: {package_name} version check failed.")
        return False

def main():
    print("\nStarting OCR Environment Validation...")
    print("-" * 40)
    
    checks = [
        check_python_version(),
        check_import("cv2"),
        check_import("fitz"),
        check_import("pdfplumber"),
        check_import("paddleocr", "PPStructure"),
        check_import("camelot"),
        check_import("pandas"),
        check_import("fastapi"),
        check_package_version("paddleocr", "2.7.3"),
        check_package_version("numpy", "1.26.4")
    ]
    
    print("-" * 40)
    if all(checks):
        print("RESULT: PASS - Environment is stable.")
        sys.exit(0)
    else:
        print("RESULT: FAIL - Environment is unstable.")
        sys.exit(1)

if __name__ == "__main__":
    main()
