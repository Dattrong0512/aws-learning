' ==========================================================================
'  AWS Learning - silent background launcher (NO terminal windows)
'  Starts: (1) the local content builder  (2) wrangler dev (remote KV binding)
'  Both run fully hidden. Nothing pops up. Run at login by the Startup
'  shortcut created via "Enable Auto-Start.cmd".
'  To stop the servers later, run "Stop AWS Learning.cmd".
' ==========================================================================
Option Explicit

Dim fso, sh, scriptDir, projDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)  ' ...\tools
projDir   = fso.GetParentFolderName(scriptDir)               ' project root
sh.CurrentDirectory = projDir

' These servers run with NO window, so anything they print is invisible - including
' fatal errors. (Classic case: Cloudflare credentials expire, wrangler exits 1 at
' login, and the site is silently dead with no clue why.) Tee both to log files so
' there is always something to read when the site isn't up.
Dim logDir
logDir = fso.BuildPath(projDir, "tools\logs")
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)

' Window style 0 = hidden, False = do not wait (fire and forget).
sh.Run "cmd /c node tools\builder.mjs > tools\logs\builder.log 2>&1", 0, False
' Plain `wrangler dev` on purpose - NOT `--remote`. The KV binding in wrangler.jsonc
' carries "remote": true, so the Worker runs locally (fast, no preview session) while
' SR still reads/writes the REAL production namespace - progress keeps syncing between
' machines. `--remote` would override that and put the whole Worker on the preview
' edge, whose token expires and silently kills the server (see wrangler.log history).
' Wrangler 4.98.0 crashes the local workerd runtime on this Windows installation.
' Pin the known-good release so background restarts keep localhost:8788 available.
sh.Run "cmd /c npx --yes wrangler@4.128.0 dev > tools\logs\wrangler.log 2>&1", 0, False
