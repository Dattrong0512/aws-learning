// Optional local authoring server; the public website never calls it.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createStudyBatches } from "./build-study-prompt.mjs";

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
  codex: { label: "Codex", model: "gpt-5.5", reasoningEffort: "high" },
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
    return sendJson(res, 200, { ok: true, service: "aws-learning-builder", port: PORT, root: ROOT,
      model: AGENTS.codex.model, reasoningEffort: AGENTS.codex.reasoningEffort });

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
    if (!/^[a-z][a-z0-9-]*$/.test(sectionHash)) return sendJson(res, 400, { ok: false, error: "Invalid section ID" });
    if (!images.length) return sendJson(res, 400, { ok: false, error: "No images" });
    if (!section) return sendJson(res, 400, { ok: false, error: "No page selected" });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = join(INBOX, `${sectionHash}-${stamp}`);
    mkdirSync(dir, { recursive: true });
    const contentPath = join(ROOT, "content");
    const backupPath = join(dir, "content.before");
    cpSync(contentPath, backupPath, { recursive: true });

    const files = saveImages(dir, images);
    if (!files.length) return sendJson(res, 400, { ok: false, error: "No valid images decoded" });
    if (note) writeFileSync(join(dir, "note.txt"), note); // kept next to the images for the record

    const batches = createStudyBatches({ section, sectionHash, isNew, dir, files, note });
    const promptPaths = batches.map((batch, i) => {
      const path = join(dir, batches.length === 1 ? "prompt.md" : `prompt-${i + 1}.md`);
      writeFileSync(path, batch.prompt);
      return path;
    });

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
      `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)`,
      `Set-Location -LiteralPath '${q(ROOT)}'`,
      `Write-Host '🤖 ${agent.label} (${agent.model}) is reading ${files.length} image(s) in ${batches.length} batch(es) for page: ${q(section)}...' -ForegroundColor Cyan`,
      `Write-Host '   (Watch below — ${agent.label} streams each step live: reading images, editing files.)' -ForegroundColor DarkGray`,
      `Write-Host ''`,
      // --verbose: stream every turn (tool calls, edits, text) live so you watch it
      // work instead of staring at a blank window until the final summary.
      // --output-format=stream-json is machine JSON; text + --verbose stays readable.
      `$agentExit = 0`,
      ...batches.flatMap((batch, i) => [
        `if ($agentExit -eq 0) {`,
        `  Write-Host 'Batch ${i + 1}/${batches.length}: ${batch.files.length} image(s)' -ForegroundColor Cyan`,
        `  $LASTEXITCODE = 1`,
        agentId === "claude"
        ? `  Get-Content -Raw -Encoding UTF8 -LiteralPath '${q(promptPaths[i])}' | claude -p --verbose --model ${agent.model} --permission-mode acceptEdits 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`
        // The Codex Windows workspace sandbox cannot spawn PowerShell in this OneDrive
        // workspace (CreateProcess access denied). Full access is required for the
        // local CLI to read images and write the explicitly scoped content import.
        : `  Get-Content -Raw -Encoding UTF8 -LiteralPath '${q(promptPaths[i])}' | codex --ask-for-approval never exec --model ${agent.model} -c model_reasoning_effort=\"${agent.reasoningEffort}\" --sandbox danger-full-access ${batch.files.map((file) => `--image '${q(join(dir, file))}'`).join(" ")} - 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
        `  $agentExit = $LASTEXITCODE`,
        `  if ($agentExit -eq 0) {`,
        `    node tools/build-site.mjs 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
        `    $agentExit = $LASTEXITCODE`,
        `    if ($agentExit -eq 0) { node tools/validate-import.mjs 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append; $agentExit = $LASTEXITCODE }`,
        `  }`,
        `}`,
      ]),
      `$validationExit = 1`,
      `if ($agentExit -eq 0) {`,
      `  Write-Host ''`,
      `  Write-Host '🔎 Validating generated study content...' -ForegroundColor Cyan`,
      `  node tools/validate-import.mjs 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
      `  $validationExit = $LASTEXITCODE`,
      `}`,
      `if ($agentExit -ne 0 -or $validationExit -ne 0) {`,
      `  Write-Host ''`,
      `  Copy-Item -Path '${q(backupPath)}/*' -Destination '${q(contentPath)}' -Recurse -Force`,
      `  node tools/build-site.mjs | Out-Null`,
      `  Write-Host ('Import failed — original content modules restored. Agent exit=' + $agentExit + ', validation exit=' + $validationExit + '. Check ${agentId}-log.txt.') -ForegroundColor Yellow`,
      `} else {`,
      `  Write-Host ''`,
      `  Write-Host '✅ Done. Content imported locally. Reload the site to see it.' -ForegroundColor Green`,
      `  Write-Host '   Run "Deploy AWS Learning.cmd" only when you want to update the public/phone version.' -ForegroundColor DarkGray`,
      `}`,
    ].join("\r\n");
    writeFileSync(runPath, "﻿" + psScript); // BOM so PowerShell reads emoji as UTF-8

    if (process.env.BUILDER_DRYRUN) {
      console.log(`▶ [dry-run] ${section}: ${files.length} image(s) → ${dir}`);
      return sendJson(res, 200, { ok: true, count: files.length, batchCount: batches.length, inbox: dir, dryRun: true });
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
    return sendJson(res, 200, { ok: true, count: files.length, batchCount: batches.length, inbox: dir, agent: agent.label, model: agent.model });
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
    return d && d.service === "aws-learning-builder" && d.model === AGENTS.codex.model
      && d.reasoningEffort === AGENTS.codex.reasoningEffort;
  } catch {
    return false;
  }
}

function listenOn(index) {
  if (index >= PORTS.length) {
    console.error(`\n  ⚠  All builder ports are in use: ${PORTS.join(", ")}.`);
    console.error(`     Start one with a port of your own:  BUILDER_PORT=48000 node tools/builder.mjs`);
    console.error(`     Set BUILDER_PORT to choose another port.\n`);
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
