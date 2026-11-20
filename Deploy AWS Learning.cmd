@echo off
REM Publish the site to the live Cloudflare URL (optional).
REM Not needed for daily use - OneDrive syncs the code and KV syncs progress.
REM Use this only if you want to review from a phone/browser without local servers.
title Deploy AWS Learning
cd /d "%~dp0"
node tools/build-site.mjs
if errorlevel 1 (
  echo Site build failed. Deployment stopped.
  pause
  exit /b 1
)
node tools/validate-content.mjs
if errorlevel 1 exit /b 1
node --test tools/*.test.mjs
if errorlevel 1 exit /b 1
echo Deploying to Cloudflare...
npx --yes wrangler@4.128.0 deploy
echo.
pause
