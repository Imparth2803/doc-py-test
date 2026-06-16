#!/bin/bash
set -e

# setup_ocr_environment.sh
# Principal Python Platform Engineer - Environment Stabilization Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
OCR_DIR="$SERVER_DIR/src/services/ocr"
VENV_PATH="$SERVER_DIR/venv_ocr"

echo "--------------------------------------------------------"
echo "Smart Document Vault - OCR Environment Setup"
echo "--------------------------------------------------------"

# 1. Verification of Python Version
echo "[1/5] Checking Python 3.11 availability..."
if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_CMD="python3.11"
elif command -v python3 >/dev/null 2>&1; then
    PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    if [ "$PY_VER" == "3.11" ]; then
        PYTHON_CMD="python3"
    else
        echo "ERROR: Python 3.11 is required. Found $PY_VER."
        echo "Please install Python 3.11 (e.g., 'brew install python@3.11' or 'apt install python3.11')"
        exit 1
    fi
else
    echo "ERROR: Python 3 not found."
    exit 1
fi
echo "Using: $($PYTHON_CMD --version)"

# 2. Virtual Environment Creation
echo "[2/5] Resetting OCR virtual environment at $VENV_PATH..."
if [ -d "$VENV_PATH" ]; then
    rm -rf "$VENV_PATH"
fi
$PYTHON_CMD -m venv "$VENV_PATH"
source "$VENV_PATH/bin/activate"

# 3. Core Upgrade
echo "[3/5] Upgrading pip and build tools..."
pip install --quiet --upgrade pip setuptools wheel

# 4. Dependency Installation
echo "[4/5] Installing pinned dependencies from requirements-lock.txt..."
if [ ! -f "$OCR_DIR/requirements-lock.txt" ]; then
    echo "ERROR: requirements-lock.txt not found in $OCR_DIR"
    exit 1
fi
pip install -r "$OCR_DIR/requirements-lock.txt"

# 5. Final Verification
echo "[5/5] Running environment validation suite..."
export PYTHONPATH="$SERVER_DIR:$PYTHONPATH"
python "$SCRIPT_DIR/validate_ocr_environment.py"

echo "--------------------------------------------------------"
echo "SUCCESS: OCR environment is ready."
echo "To activate: source $VENV_PATH/bin/activate"
echo "To start:    cd $SERVER_DIR && python -m uvicorn src.services.ocr.ocr_server:app --port 8001"
echo "--------------------------------------------------------"
