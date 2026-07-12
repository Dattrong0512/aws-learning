@echo off
REM Run ONCE per machine to create an "AWS Learning" icon (folder + Desktop).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\make-shortcut.ps1"
echo.
pause
