#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "============================================================"
echo "  Flow — AI-Native Multi-Board Work Todo & Kanban Launcher"
echo "============================================================"

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing npm dependencies..."
  npm install
else
  echo "[1/3] Dependencies verified."
fi

echo "[2/3] Building frontend assets..."
npm run build

echo "[3/3] Starting Flow production server on http://0.0.0.0:${PORT:-3001} ..."
PORT=${PORT:-3001} HOST=0.0.0.0 npm start
