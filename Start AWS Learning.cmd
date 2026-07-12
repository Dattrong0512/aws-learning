@echo off
REM ==========================================================================
REM  AWS Learning - one double-click launcher
REM  Starts: (1) the local content builder  (2) wrangler dev --remote
REM  then opens the site. Works on any machine (uses its own folder path).
REM ==========================================================================
title AWS Learning
cd /d "%~dp0"

echo.
echo   AWS Learning launcher
echo   =====================
echo   Folder: %~dp0
echo.

REM --- prerequisite checks ---
where node >nul 2>&1
if errorlevel 1 (
  echo   [X] Node.js not found. Install it from https://nodejs.org then retry.
  echo.
  pause
  exit /b 1
)
where claude >nul 2>&1
if errorlevel 1 (
  echo   [!] Warning: 'claude' CLI not on PATH.
  echo       The "Tao noi dung" button will not be able to launch Claude.
  echo       Install Claude Code and re-run.
  echo.
)

echo   [1/3] Starting content builder (port 4545)...
start "AWS Content Builder" cmd /k "node tools\builder.mjs"

echo   [2/3] Starting wrangler dev --remote (shared KV = sync)...
start "AWS Wrangler (dev --remote)" cmd /k "npx --yes wrangler dev --remote"

echo   [3/3] Opening the site once the servers are up...
timeout /t 9 /nobreak >nul
start "" "http://localhost:8787"

echo.
echo   Done. Two terminal windows are now running.
echo   In the site, DOUBLE-CLICK the "Nhap anh" icon to import lecture images.
echo.
echo   To stop: close the two terminal windows (Builder + Wrangler).
echo.
timeout /t 6 /nobreak >nul
exit /b 0
