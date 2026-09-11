# Registers (or removes) an auto-start entry so the AWS Learning servers
# launch hidden at every login. Run once per machine via the .cmd wrappers.
#   Enable:  setup-autostart.ps1
#   Disable: setup-autostart.ps1 -Disable
param([switch]$Disable)
$ErrorActionPreference = 'Stop'

$proj    = Split-Path -Parent $PSScriptRoot                  # project root
$vbs     = Join-Path $PSScriptRoot 'aws-learning-background.vbs'
$startup = [Environment]::GetFolderPath('Startup')           # this machine's Startup folder
$link    = Join-Path $startup 'AWS Learning (background).lnk'

if ($Disable) {
  if (Test-Path $link) { Remove-Item $link -Force; Write-Host "Auto-start DISABLED: $link" -ForegroundColor Yellow }
  else { Write-Host "Auto-start was not enabled (nothing to remove)." }
  return
}

if (-not (Test-Path $vbs)) { throw "Missing launcher: $vbs" }

$W = New-Object -ComObject WScript.Shell
$s = $W.CreateShortcut($link)
$s.TargetPath       = "$env:SystemRoot\System32\wscript.exe"
$s.Arguments        = '"' + $vbs + '"'
$s.WorkingDirectory = $proj
$s.IconLocation     = "$env:SystemRoot\System32\shell32.dll,13"
$s.Description       = 'AWS Learning - background servers (builder + wrangler dev --remote), hidden'
$s.Save()
Write-Host "Auto-start ENABLED at login: $link" -ForegroundColor Green

# Remove the old click-to-run icons - now redundant.
$oldIcons = @(
  (Join-Path $proj 'AWS Learning.lnk')
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'AWS Learning.lnk')
)
foreach ($o in $oldIcons) {
  if (Test-Path $o) { Remove-Item $o -Force; Write-Host "Removed old click-to-run icon: $o" }
}
