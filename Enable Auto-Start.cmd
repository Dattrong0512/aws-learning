@echo off
REM ==========================================================================
REM  Run ONCE per machine. Makes AWS Learning start hidden at every login
REM  (no terminal windows, no icon to click). Also starts it right now.
REM ==========================================================================
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup-autostart.ps1"
if errorlevel 1 (
  echo.
  echo   [X] Failed to enable auto-start. See the message above.
  pause
  exit /b 1
)

echo.
echo   Starting the servers now (hidden) so you don't have to log out/in...
start "" wscript "%~dp0tools\aws-learning-background.vbs"

echo.
echo   Done. From now on the servers launch silently at login.
echo   Open the site any time at:  http://localhost:8788
echo   To stop them:               run "Stop AWS Learning.cmd"
echo   To turn auto-start off:      run "Disable Auto-Start.cmd"
echo.
pause
