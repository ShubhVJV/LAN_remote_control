@echo off
title LAN Remote Control - Agent (Computer B)
cd /d "%~dp0\.."
echo ========================================================
echo  Starting Remote Agent (Computer B)
echo ========================================================
echo.
echo Remote Agent listening on port 8000
echo Announcing on LAN UDP discovery port 50050
echo Pairing PIN: 123456
echo.
python -m remote_agent.agent --port 8000
pause
