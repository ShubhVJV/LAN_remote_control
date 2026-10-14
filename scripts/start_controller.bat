@echo off
title LAN Remote Control - Controller (Computer A)
cd /d "%~dp0\.."
echo ========================================================
echo  Starting Controller Application (Computer A)
echo ========================================================
echo.
echo Controller Backend running on http://localhost:8080
echo Serving Web Dashboard...
echo.
python -m controller.backend.app.main --port 8080
pause
