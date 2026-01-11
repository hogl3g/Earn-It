#!/usr/bin/env bash
set -euo pipefail

# Create a Python virtual environment and install requirements.
# Usage: ./install.sh

PYTHON=${PYTHON:-python3}

echo "Creating virtual environment 'venv' using ${PYTHON}..."
$PYTHON -m venv venv

echo "Activating venv and installing requirements..."
. venv/bin/activate
pip install --upgrade pip
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  echo "No requirements.txt found; skipping pip install."
fi

echo "Done. To activate the environment: source venv/bin/activate"
