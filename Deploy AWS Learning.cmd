@echo off
REM Publish the site to the live Cloudflare URL (optional).
REM Not needed for daily use - OneDrive syncs the code and KV syncs progress.
REM Use this only if you want to review from a phone/browser without local servers.
title Deploy AWS Learning
cd /d "%~dp0"
echo Deploying to Cloudflare...
npx --yes wrangler deploy
echo.
pause
