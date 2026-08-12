#!/bin/bash
# Script Peluncur PCB Layout Tiler & Auto-Panelizer Web App

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "⚡ PCB Layout Tiler & Auto-Panelizer Web App ⚡"
echo "=================================================="

# Check virtualenv
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

echo "Starting Flask Web App on http://127.0.0.1:5050..."
echo "Akses aplikasi di browser: http://pcb-tiler.test (atau http://127.0.0.1:5050)"
echo "Tekan Ctrl+C untuk menghentikan aplikasi."
echo "=================================================="

./venv/bin/python3 app.py
