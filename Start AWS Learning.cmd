@echo off
cd /d "%~dp0"
node tools/build-site.mjs
if errorlevel 1 exit /b 1
start "AWS Learning" /b cmd /c "npx --yes wrangler@4.128.0 dev"
start "" "http://localhost:8788"
