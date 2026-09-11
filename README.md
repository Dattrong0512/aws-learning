# AWS Learning 📚

Personal AWS SAA-C03 study site — a Cloudflare Worker serving a Notion-style single page
(`public/index.html`) with built-in **spaced repetition** (state in Workers KV) and an
image-to-content importer powered by a selectable Claude Code or Codex CLI agent.

## Quick start (new machine)

```bash
# one-off setup
# 1. Install Node.js plus Claude Code (`claude` on PATH); optionally install Codex (`codex` on PATH)
npx wrangler login          # 2. connect wrangler to the Cloudflare account (one time)

# enable hidden startup once per machine and start it now
"Enable Auto-Start.cmd"
```

That registers a Startup shortcut and launches the content builder plus plain
`wrangler dev` hidden in the background. The Worker runs locally while the `SR`
binding uses the shared remote KV namespace. Open **http://localhost:8788**; use
`Stop AWS Learning.cmd` or `Disable Auto-Start.cmd` when needed.

## Importing lecture screenshots

1. Open http://localhost:8788 and double-click the **🖼️ Nhập ảnh** icon.
2. Paste (Ctrl+V), drag/drop or select one or more images; choose the destination page and optionally add an AI instruction.
3. Click **🚀 Tạo nội dung**, then choose Codex (the default, `gpt-5.6-terra`, high reasoning) or Claude (`claude-opus-4-8`). A PowerShell window opens where the selected agent reads all images together, groups and deduplicates related AWS concepts, and merges them into existing major topics where appropriate.
4. The generated HTML is validated before `npx wrangler deploy`; invalid output is rolled back automatically. Reload the site once so `/api/sync` registers or migrates the grouped topics without losing review state.

## How things sync

| What | Where | How |
|------|-------|-----|
| Content (`public/index.html`) | This repo | Git / OneDrive |
| Review progress (intervals, due dates) | Cloudflare KV (`SR`) | Plain `wrangler dev` uses the binding's `remote: true` production namespace on every machine |

No secrets live in this repo — auth is via `npx wrangler login` (Cloudflare) and the
`claude` CLI login on each machine. If a real secret is ever needed, use
`npx wrangler secret put NAME`, never commit it.

Full conventions and architecture: see [CLAUDE.md](CLAUDE.md).
