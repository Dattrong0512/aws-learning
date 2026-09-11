@echo off
REM Removes the login auto-start entry on THIS machine. Does not stop
REM servers that are already running - use "Stop AWS Learning.cmd" for that.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup-autostart.ps1" -Disable
echo.
pause
