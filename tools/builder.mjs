/**
 * AWS Learning – Local Content Builder
 * ------------------------------------
 * Companion server for the "🖼️ Nhập ảnh" feature in public/index.html.
 *
 * A Cloudflare Worker cannot spawn a terminal, so this small Node server does it:
 *   1. Receives pasted lecture images + the chosen page from the browser.
 *   2. Saves the images to tools/inbox/<page>-<timestamp>/.
 *   3. Writes a tailored prompt.
 *   4. Spawns `claude --model claude-opus-4-8` in a new terminal window to read the
 *      images and add study toggles to that page in public/index.html.
 *   5. When Claude finishes successfully, runs `npx wrangler deploy` in the same
 *      window so the new content is published to Cloudflare automatically.
 *
 * Run from the project root:   node tools/builder.mjs
 * Then open the site locally (wrangler dev, http://localhost:8787) and double-click
 * the "🖼️ Nhập ảnh" icon.
 *
 * No npm dependencies — Node built-ins only.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const PORT = 4545;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = join(ROOT, "tools", "inbox");
const MODEL = "claude-opus-4-8";

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

// Build the instruction prompt handed to Claude.
function buildPrompt({ section, sectionHash, isNew, dir, files }) {
  const list = files.map((f) => `  - ${join(dir, f)}`).join("\n");
  const newSectionStep = isNew
    ? `- This is a **NEW page** named "${section}". First create the section following the
  "Adding a whole new section" guide in CLAUDE.md: add a nav card, a
  <section id="sec-${sectionHash}"> with <div class="content" data-sec="${sectionHash}">,
  and a matching entry in the SECTIONS array in the page JS
  ({hash:"${sectionHash}", el:"sec-${sectionHash}", icon:"<pick a fitting emoji>", name:"${section}", key:"${section}"}).`
    : `- Add the content into the EXISTING page "${section}" (its content div is data-sec="${sectionHash}").`;

  return `You are adding study material to an AWS SAA-C03 revision site. Working directory is this project.

FIRST read ./CLAUDE.md to learn the toggle/import conventions, then read every image below.

Lecture images to read (${files.length}):
${list}

Target page: "${section}"
${newSectionStep}

Your task:
- For each distinct concept in the images, add ONE study toggle into that page:
  <details class="topic" data-track="<Unique Vietnamese title>"> … </details>
  (use class="sub" for sub-points nested inside a topic). Every data-track MUST be unique
  across the whole page — that value is the spaced-repetition tracking key.
- If an image contains a DIAGRAM, table, or architecture flow, DO NOT just describe it.
  Recreate it as clean HTML/CSS or inline SVG (styled boxes, arrows, real <table>) so it is
  visually self-explanatory and easy to review at a glance. Make it as close to the original
  as reasonably possible.
- Write in **Vietnamese**. Keep it CONCISE but exam-complete for AWS SAA-C03: include the
  key facts, limits/quotas, "when to use", and common exam gotchas. No filler, no fluff —
  enough to actually learn from, not a wall of text.
- Follow the HTML formatting conventions in CLAUDE.md (h3/h4, ul, table, pre/code, blockquote 🧠).
- Only edit public/index.html. Do not touch src/worker.js — new toggles auto-register via /api/sync.

When done, print a short bullet list of the data-track titles you added.`;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true, root: ROOT });

  if (req.method === "POST" && url.pathname === "/build") {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "Bad JSON" }); }
    const images = Array.isArray(body.images) ? body.images : [];
    const section = (body.section || "").trim();
    const sectionHash = (body.sectionHash || "").trim() || "misc";
    const isNew = !!body.isNew;
    if (!images.length) return sendJson(res, 400, { ok: false, error: "No images" });
    if (!section) return sendJson(res, 400, { ok: false, error: "No page selected" });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = join(INBOX, `${sectionHash}-${stamp}`);
    mkdirSync(dir, { recursive: true });

    const files = saveImages(dir, images);
    if (!files.length) return sendJson(res, 400, { ok: false, error: "No valid images decoded" });

    const prompt = buildPrompt({ section, sectionHash, isNew, dir, files });
    const promptPath = join(dir, "prompt.md");
    writeFileSync(promptPath, prompt);

    // Launch Claude in a NEW visible PowerShell window so the user can watch it work.
    //
    // IMPORTANT: we write a self-contained run.ps1 and launch it with `-File`.
    // Do NOT inline the command via `-Command "... | claude ..."`: when that string
    // is passed through `cmd /c start`, cmd's parser swallows the `|`, so
    // `Get-Content prompt.md` never reaches claude — claude gets an EMPTY prompt and
    // silently does nothing (the "saved images but no content" bug). A script file
    // keeps the pipe intact. We also Tee claude's output to claude-log.txt for debugging.
    const logPath = join(dir, "claude-log.txt");
    const runPath = join(dir, "run.ps1");
    const q = (p) => p.replace(/'/g, "''");
    const psScript = [
      `$ErrorActionPreference = 'Continue'`,
      `Set-Location -LiteralPath '${q(ROOT)}'`,
      `Write-Host '🤖 Claude (${MODEL}) is reading ${files.length} image(s) for page: ${section}...' -ForegroundColor Cyan`,
      `Get-Content -Raw -LiteralPath '${q(promptPath)}' | claude -p --model ${MODEL} --permission-mode acceptEdits 2>&1 | Tee-Object -FilePath '${q(logPath)}'`,
      `if ($LASTEXITCODE -ne 0) {`,
      `  Write-Host ''`,
      `  Write-Host ('⚠ Claude exited with code ' + $LASTEXITCODE + ' — skipping deploy. Check claude-log.txt next to the images.') -ForegroundColor Yellow`,
      `} else {`,
      `  Write-Host ''`,
      `  Write-Host '🚀 Deploying to Cloudflare (npx wrangler deploy)...' -ForegroundColor Cyan`,
      `  npx wrangler deploy 2>&1 | Tee-Object -FilePath '${q(logPath)}' -Append`,
      `  if ($LASTEXITCODE -ne 0) {`,
      `    Write-Host '⚠ Deploy failed — content was imported locally but NOT published. Run "npx wrangler deploy" manually.' -ForegroundColor Yellow`,
      `  } else {`,
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
      return sendJson(res, 500, { ok: false, error: "Could not launch claude: " + e.message });
    }

    console.log(`▶ ${section}: ${files.length} image(s) → ${dir}`);
    return sendJson(res, 200, { ok: true, count: files.length, inbox: dir });
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n  ⚠  Port ${PORT} is already in use — a content builder is probably already running.`);
    console.error(`     You can close this window; the existing builder will keep handling requests.`);
    console.error(`     (If it's actually stuck, close all builder windows and start one fresh.)\n`);
    process.exit(0);
  }
  throw e;
});

server.listen(PORT, () => {
  console.log(`\n  AWS Learning content builder`);
  console.log(`  ├─ listening on   http://localhost:${PORT}`);
  console.log(`  ├─ project root   ${ROOT}`);
  console.log(`  ├─ inbox          ${INBOX}`);
  console.log(`  └─ model          ${MODEL}\n`);
  console.log(`  Open the site (wrangler dev) and double-click "🖼️ Nhập ảnh".\n`);
});
