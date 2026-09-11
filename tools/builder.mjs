/**
 * AWS Learning – Local Content Builder
 * ------------------------------------
 * Companion server for the "🖼️ Nhập ảnh" feature in public/index.html.
 *
 * A Cloudflare Worker cannot spawn a terminal, so this small Node server does it:
 *   1. Receives pasted lecture images + the chosen page from the browser.
 *   2. Saves the images to tools/inbox/<page>-<timestamp>/.
 *   3. Writes a tailored prompt.
 *   4. Spawns the selected Claude or Codex CLI in a new terminal window to read the
 *      images and add study toggles to that page in public/index.html.
 *   5. When the selected agent finishes successfully, runs `npx wrangler deploy` in the same
 *      window so the new content is published to Cloudflare automatically.
 *
 * Run from the project root:   node tools/builder.mjs
 * Then open the site locally (wrangler dev, http://localhost:8788) and double-click
 * the "🖼️ Nhập ảnh" icon.
 *
 * No npm dependencies — Node built-ins only.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createStudyPrompt } from "./build-study-prompt.mjs";

// Port: 4545 was too popular (it's a common default for other dev tools, so it kept
// colliding). 47450 sits in the IANA dynamic/private range and is not a registered
// service port. If it IS somehow taken we walk the next few — the page probes the
// same list via /health, so whichever one we land on is found automatically.
// Override with:  BUILDER_PORT=1234 node tools/builder.mjs
const PORTS = process.env.BUILDER_PORT ? [Number(process.env.BUILDER_PORT)] : [47450, 47451, 47452, 47453];
let PORT = PORTS[0];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = join(ROOT, "tools", "inbox");
const AGENTS = {
  claude: { label: "Claude", model: "claude-opus-4-8" },
  codex: { label: "Codex", model: "gpt-5.6-terra", reasoningEffort: "high" },
};

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}
function sendJson(res, status, obj) {
  cors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, bad) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { bad(e); } });
    req.on("error", bad);
  });
}

// Save each data-URL image to disk; return saved file names.
function saveImages(dir, images) {
  const files = [];
  images.forEach((dataUrl, i) => {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
    if (!m) return;
    const ext = EXT[m[1].toLowerCase()] || "png";
    const name = String(i + 1).padStart(2, "0") + "." + ext;
    writeFileSync(join(dir, name), Buffer.from(m[2], "base64"));
    files.push(name);
  });
  return files;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // `service` lets the page tell OUR builder apart from whatever else may answer
  // on a probed port.
  if (req.method === "GET" && url.pathname === "/health")
    return sendJson(res, 200, { ok: true, service: "aws-learning-builder", port: PORT, root: ROOT });

  if (req.method === "POST" && url.pathname === "/build") {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "Bad JSON" }); }
    const images = Array.isArray(body.images) ? body.images : [];
    const section = (body.section || "").trim();
    const sectionHash = (body.sectionHash || "").trim() || "misc";
    const isNew = !!body.isNew;
    const note = typeof body.note === "string" ? body.note.trim() : "";
    // Codex is the safe default even if an older page sends no `agent` field.
    const agentId = body.agent === "claude" ? "claude" : "codex";
    const agent = AGENTS[agentId];
    if (!images.length) return sendJson(res, 400, { ok: false, error: "No images" });
    if (!section) return sendJson(res, 400, { ok: false, error: "No page selected" });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = join(INBOX, `${sectionHash}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    const indexPath = join(ROOT, "public", "index.html");
    const backupPath = join(dir, "index.before.html");
    copyFileSync(indexPath, backupPath);

    const files = saveImages(dir, images);
    if (!files.length) return sendJson(res, 400, { ok: false, error: "No valid images decoded" });
    if (note) writeFileSync(join(dir, "note.txt"), note); // kept next to the images for the record

    const prompt = createStudyPrompt({ section, sectionHash, isNew, dir, files, note });
    const promptPath = join(dir, "prompt.md");
    writeFileSync(promptPath, prompt);

    // Launch the selected agent in a NEW visible PowerShell window so the user can watch it work.
    //
    // IMPORTANT: we write a self-contained run.ps1 and launch it with `-File`.
    // Do NOT inline the command via `-Command "... | claude ..."`: when that string
    // is passed through `cmd /c start`, cmd's parser swallows the `|`, so
    // `Get-Content prompt.md` never reaches claude — claude gets an EMPTY prompt and
    // silently does nothing (the "saved images but no content" bug). A script file
    // keeps the pipe intact. We also tee the agent's output to a log for debugging.
    const logPath = join(dir, `${agentId}-log.txt`);
    const runPath = join(dir, "run.ps1");
    const q = (p) => p.replace(/'/g, "''");
    const psScript = [
      `$ErrorActionPreference = 'Continue'`,
      `Set-Location -LiteralPath '${q(ROOT)}'`,
      `Write-Host '🤖 ${agent.label} (${agent.model}) is reading ${files.length} image(s) for page: ${section}...' -ForegroundColor Cyan`,
      `Write-Host '   (Watch below — ${agent.label} streams each step live: reading images, editing files.)' -ForegroundColor DarkGray`,
      `Write-Host ''`,
      // --verbose: stream every turn (tool calls, edits, text) live so you watch it
      // work instead of staring at a blank window until the final summary.
      // --output-format=stream-json is machine JSON; text + --verbose stays readable.
      agentId === "claude"
        ? `Get-Content -Raw -LiteralPath '${q(promptPath)}' | claude -p --verbose --model ${agent.model} --permission-mode acceptEdits 2>&1 | Tee-Object -FilePath '${q(logPath)}'`
        // The Codex Windows workspace sandbox cannot spawn PowerShell in this OneDrive
        // workspace (CreateProcess access denied). Full access is required for the
        // local CLI to read images and write the explicitly scoped index.html import.
        : `Get-Content -Raw -LiteralPath '${q(promptPath)}' | codex --ask-for-approval never exec --model ${agent.model} -c model_reasoning_effort=\"${agent.reasoningEffort}\" --sandbox danger-full-access ${files.map((file) => `--image '${q(join(dir, file))}'`).join(" ")} - 2>&1 | Tee-Object -FilePath '${q(logPath)}'`,
      `$agentExit = $LASTEXITCODE`,
      `$validationExit = 1`,
      `if ($agentExit -eq 0) {`,
      `  Write-Host ''`,
      `  Write-Host '🔎 Validating generated study content...' -ForegroundColor Cyan`,
      `  node tools/validate-import.mjs 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
      `  $validationExit = $LASTEXITCODE`,
      `}`,
      `if ($agentExit -ne 0 -or $validationExit -ne 0) {`,
      `  Write-Host ''`,
      `  Copy-Item -LiteralPath '${q(backupPath)}' -Destination '${q(indexPath)}' -Force`,
      `  Write-Host ('⚠ Import failed or produced invalid HTML — original index.html restored; deploy skipped. Agent exit=' + $agentExit + ', validation exit=' + $validationExit + '. Check ${agentId}-log.txt.') -ForegroundColor Yellow`,
      `} else {`,
      `  Write-Host ''`,
      `  Write-Host '🚀 Deploying to Cloudflare (npx wrangler deploy)...' -ForegroundColor Cyan`,
      `  npx wrangler deploy 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
      `  if ($LASTEXITCODE -ne 0) {`,
      `    Write-Host '⚠ Deploy failed — content was imported locally but NOT published. Run "npx wrangler deploy" manually.' -ForegroundColor Yellow`,
      `  } else {`,
      // Clear this section's saved KV snapshot so the freshly-imported source HTML
      // wins. Without this, a section that was ever edited live keeps serving its
      // old snapshot and the new toggles never appear ("content didn't change").
      // wrangler dev --remote on :8788 shares the same remote KV, so one call fixes
      // both local and production. Best-effort — never blocks the deploy.
      `    Write-Host ''`,
      `    Write-Host '🧹 Clearing saved page snapshot so the new content shows...' -ForegroundColor Cyan`,
      `    try {`,
      `      Invoke-RestMethod -Method Post -Uri 'http://localhost:8788/api/content' -ContentType 'application/json' -Body '{"sections":{"${sectionHash}":null}}' -TimeoutSec 15 | Out-Null`,
      `      Write-Host '   ✓ Snapshot cleared.' -ForegroundColor DarkGray`,
      `    } catch {`,
      `      Write-Host '   (Could not reach http://localhost:8788 to clear the snapshot. If the new content does not appear, open the site with the servers running and try importing again.)' -ForegroundColor Yellow`,
      `    }`,
      `    Write-Host ''`,
      `    Write-Host '✅ Done. Content imported and deployed. Reload the site once so /api/sync registers the new toggles.' -ForegroundColor Green`,
      `  }`,
      `}`,
    ].join("\r\n");
    writeFileSync(runPath, "﻿" + psScript); // BOM so PowerShell reads emoji as UTF-8

    if (process.env.BUILDER_DRYRUN) {
      console.log(`▶ [dry-run] ${section}: ${files.length} image(s) → ${dir}`);
      return sendJson(res, 200, { ok: true, count: files.length, inbox: dir, dryRun: true });
    }

    try {
      const child = spawn(
        "cmd",
        ["/c", "start", "AWS Content Builder", "powershell", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runPath],
        { cwd: ROOT, detached: true, stdio: "ignore" },
      );
      child.unref();
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: `Could not launch ${agentId}: ` + e.message });
    }

    console.log(`▶ ${agent.label} · ${section}: ${files.length} image(s) → ${dir}`);
    return sendJson(res, 200, { ok: true, count: files.length, inbox: dir, agent: agent.label, model: agent.model });
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

// Try each candidate port in turn. A port is only "taken" from our point of view if
// something else holds it; if the holder is another copy of this builder, there is
// nothing to do and we bow out quietly.
async function isOurBuilder(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    const d = await r.json();
    return d && d.service === "aws-learning-builder";
  } catch {
    return false;
  }
}

function listenOn(index) {
  if (index >= PORTS.length) {
    console.error(`\n  ⚠  All builder ports are in use: ${PORTS.join(", ")}.`);
    console.error(`     Start one with a port of your own:  BUILDER_PORT=48000 node tools/builder.mjs`);
    console.error(`     (and set BUILDER_PORTS in public/index.html to match).\n`);
    process.exit(1);
  }

  PORT = PORTS[index];
  server.once("error", async (e) => {
    if (e.code !== "EADDRINUSE") throw e;
    if (await isOurBuilder(PORT)) {
      console.error(`\n  ⚠  A content builder is already running on port ${PORT}.`);
      console.error(`     You can close this window; the existing builder keeps handling requests.`);
      console.error(`     (If it's actually stuck, run "Stop AWS Learning.cmd" and start one fresh.)\n`);
      process.exit(0);
    }
    console.error(`  · Port ${PORT} is taken by something else — trying ${PORTS[index + 1] ?? "(no more ports)"}…`);
    listenOn(index + 1);
  });
  server.listen(PORT);
}

server.on("listening", () => {
  console.log(`\n  AWS Learning content builder`);
  console.log(`  ├─ listening on   http://localhost:${PORT}`);
  console.log(`  ├─ project root   ${ROOT}`);
  console.log(`  ├─ inbox          ${INBOX}`);
  console.log(`  └─ default agent  ${AGENTS.codex.label} (${AGENTS.codex.model}, ${AGENTS.codex.reasoningEffort})\n`);
  console.log(`  Open the site (wrangler dev) and double-click "🖼️ Nhập ảnh".\n`);
});

listenOn(0);
