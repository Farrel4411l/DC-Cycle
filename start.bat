@echo off
setlocal enabledelayedexpansion

echo ============================================================================
echo   DC-Cycle — Data Center Circularity ^& Rare Earth Traceability Platform
echo   Starting FastAPI Backend (port 8001) + React Vite Frontend (port 5173)
echo ============================================================================
echo.

cd /d "%~dp0"

REM --- Backend setup & launch ---
if not exist "backend\.venv\Scripts\python.exe" (
    echo [Backend] Creating Python virtual environment and installing dependencies...
    pushd backend
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install --upgrade pip >nul
    .venv\Scripts\python.exe -m pip install -r requirements.txt
    popd
)

echo [Backend] Launching FastAPI + SQLite server on http://127.0.0.1:8001 ...
start "DC-Cycle Backend (FastAPI :8001)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

REM --- Frontend setup & launch ---
if not exist "frontend\node_modules" (
    echo [Frontend] Installing npm dependencies...
    pushd frontend
    call npm install
    popd
)

echo [Frontend] Launching Vite dev server on http://localhost:5173 ...
start "DC-Cycle Frontend (Vite :5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --port 5173"

echo.
echo Waiting for services to initialize...
timeout /t 4 /nobreak >nul
start "" http://localhost:5173

echo DC-Cycle is running!
echo   Frontend UI : http://localhost:5173
echo   API Docs    : http://127.0.0.1:8001/docs
echo.
pause
