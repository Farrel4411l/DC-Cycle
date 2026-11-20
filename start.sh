#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "============================================================================"
echo "  DC-Cycle — Data Center Circularity & Rare Earth Traceability Platform"
echo "  Starting FastAPI Backend (port 8001) + React Vite Frontend (port 5173)"
echo "============================================================================"

if [ ! -d "backend/.venv" ]; then
  echo "[Backend] Creating Python virtual environment and installing dependencies..."
  python3 -m venv backend/.venv
  backend/.venv/bin/python -m pip install --upgrade pip >/dev/null
  backend/.venv/bin/python -m pip install -r backend/requirements.txt
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "[Frontend] Installing npm dependencies..."
  (cd frontend && npm install)
fi

cleanup() {
  echo ""
  echo "Shutting down DC-Cycle services..."
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[Backend] Launching FastAPI + SQLite on http://127.0.0.1:8001"
(cd backend && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload) &
BACKEND_PID=$!

echo "[Frontend] Launching Vite dev server on http://localhost:5173"
(cd frontend && npm run dev -- --port 5173) &
FRONTEND_PID=$!

sleep 3
if command -v open >/dev/null 2>&1; then
  open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:5173"
fi

echo ""
echo "DC-Cycle is running!"
echo "  Frontend UI : http://localhost:5173"
echo "  API Docs    : http://127.0.0.1:8001/docs"
echo "Press Ctrl+C to stop both services."

wait
