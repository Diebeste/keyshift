@echo off
rem Key Shift for Windows: double-click to start, then use the browser tab that opens. Close this window to stop.
cd /d "%~dp0"
set PORT=8765
where py >nul 2>nul && (py -3 serve.py %PORT% & goto :eof)
where python >nul 2>nul && (python serve.py %PORT% & goto :eof)
where node >nul 2>nul && (node serve.mjs %PORT% & goto :eof)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT% & goto :eof
echo Could not start a server. Install Python 3 (python.org) or Node (nodejs.org), then double-click again.
pause
