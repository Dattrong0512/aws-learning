# AWS Learning 📚

Personal AWS SAA-C03 study site — a Cloudflare Worker serving a Notion-style single page
(`public/index.html`) with built-in **spaced repetition** (state in Workers KV) and an
image-to-content importer powered by Claude Code.

## Quick start (new machine)

```bash
# one-off setup
# 1. Install Node.js (https://nodejs.org) and Claude Code (`claude` on PATH)
npx wrangler login          # 2. connect wrangler to the Cloudflare account (one time)

# run it
Start "AWS Learning.cmd"    # or double-click "Start AWS Learning.cmd"
```

That launches two windows — the content builder (`node tools/builder.mjs`) and
`npx wrangler dev --remote` — and opens the site at **http://localhost:8787**.

Optional: double-click `Create Desktop Icon.cmd` to get the desktop shortcut.

## Importing lecture screenshots

1. Open http://localhost:8787 and double-click the **🖼️ Nhập ảnh** icon.
2. Paste images (Ctrl+V), pick the target page, click **🚀 Tạo nội dung**.
3. A PowerShell window opens where Claude (`claude-opus-4-8`) reads the images, adds
   study toggles to `public/index.html`, then auto-runs `npx wrangler deploy`.
4. Reload the site once — `/api/sync` registers the new toggles into the review schedule.

## How things sync

| What | Where | How |
|------|-------|-----|
| Content (`public/index.html`) | This repo | Git / OneDrive |
| Review progress (intervals, due dates) | Cloudflare KV (`SR`) | `wrangler dev --remote` shares the same production namespace on every machine |

No secrets live in this repo — auth is via `npx wrangler login` (Cloudflare) and the
`claude` CLI login on each machine. If a real secret is ever needed, use
`npx wrangler secret put NAME`, never commit it.

Full conventions and architecture: see [CLAUDE.md](CLAUDE.md).
