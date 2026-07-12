# Creates an "AWS Learning" application shortcut (.lnk) with an icon,
# pointing at "Start AWS Learning.cmd". Run once per machine.
$ErrorActionPreference = 'Stop'

$proj   = Split-Path -Parent $PSScriptRoot                 # project root
$target = Join-Path $proj 'Start AWS Learning.cmd'
if (-not (Test-Path $target)) { throw "Launcher not found: $target" }

$icon = "$env:SystemRoot\System32\shell32.dll,13"          # blue globe icon
$W    = New-Object -ComObject WScript.Shell

$dests = @(
  (Join-Path $proj 'AWS Learning.lnk')                     # icon inside the folder
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'AWS Learning.lnk')  # + on Desktop
)

foreach ($dest in $dests) {
  $s = $W.CreateShortcut($dest)
  $s.TargetPath       = $target
  $s.WorkingDirectory = $proj
  $s.IconLocation     = $icon
  $s.Description       = 'AWS Learning - paste lecture images, build content with Claude'
  $s.Save()
  Write-Host "Created: $dest"
}

Write-Host ""
Write-Host "Double-click 'AWS Learning' (folder or Desktop) to launch." -ForegroundColor Green
