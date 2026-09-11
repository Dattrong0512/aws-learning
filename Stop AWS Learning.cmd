@echo off
REM Stops the hidden AWS Learning background servers (builder + wrangler dev).
REM Since they run with no window, this is how you shut them down.
REM Match only node.exe/workerd.exe (the actual servers) so this script never
REM kills the shell running it, even though its own text contains 'wrangler'.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and ($_.CommandLine -match 'builder\.mjs' -or $_.CommandLine -match 'wrangler')) -or $_.Name -eq 'workerd.exe' }; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host ('Stopped ' + @($p).Count + ' AWS Learning process(es).') -ForegroundColor Yellow } else { Write-Host 'No AWS Learning servers were running.' }"
echo.
timeout /t 3 /nobreak >nul
