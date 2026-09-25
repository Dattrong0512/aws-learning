# AWS Learning — Import & Tracking Guide

A Cloudflare Worker that serves a Notion-style single-page study site (`public/index.html`)
with a built-in **spaced-repetition** tracker (state stored in Workers KV, namespace `SR`).

- `public/index.html` — the whole study page (content + UI + client JS).
- `src/worker.js` — API + cron + static serving. Holds the initial `SEED` and the SR algorithm.
- Content is organized into **sections**; each major study concept/service is one tracked
  **toggle** (`<details>`). Features normally remain headings inside that toggle.

---

## Run it & sync between machines (company ↔ home)

**Nothing to click — it runs at login.** The two servers (content builder +
`wrangler dev`) start **hidden in the background** every time you log in, via a
Startup-folder shortcut. No terminal windows appear. Open the site whenever you want at
`http://localhost:8788`.

- `tools/aws-learning-background.vbs` — the silent launcher (starts both servers with hidden windows).
- **`Enable Auto-Start.cmd`** — run once per machine: registers the login entry, starts the servers now, and removes the old click-to-run icons.
- **`Disable Auto-Start.cmd`** — removes the login entry on this machine.
- **`Stop AWS Learning.cmd`** — stops the hidden servers (they have no window to close).
- `Start AWS Learning.cmd` — optional manual launch that opens the two servers in *visible* windows (fallback/debugging).

**If the site doesn't load, read the logs first.** The background servers have no window, so
their output (including fatal errors) goes to `tools/logs/builder.log` and `tools/logs/wrangler.log`.
The most common failure by far: Cloudflare credentials expire → `wrangler dev` can't reach the
remote KV and the site is silently dead. Fix with `npx wrangler login`, then re-run
`Enable Auto-Start.cmd` (or just log out and back in).

A healthy start logs this binding table — check the **Mode** column first when debugging:

```
env.SR (…)     KV Namespace   remote     ← progress syncs between machines
env.ASSETS     Assets         local
⎔ Starting local server...
[wrangler:info] Ready on http://127.0.0.1:8788
```

If you instead see `⎔ Starting remote preview...` / `Preview token expired`, something has
re-added `--remote` — see the warning below.

**First-time setup on each machine (one-off):**
1. Install [Node.js](https://nodejs.org) and Claude Code (the `claude` CLI must be on `PATH`).
2. `npx wrangler login` (needed once so the remote KV binding can reach your Cloudflare account).
3. Double-click **`Enable Auto-Start.cmd`** — from then on the servers launch silently at every login.

**How the two things sync — no manual copying:**

| What | Where it lives | How it syncs |
|------|----------------|--------------|
| Learning content (toggles in `index.html`) | This folder | **OneDrive** — same folder on both machines |
| Review progress (intervals, due dates) | Cloudflare **KV** (`SR`) | the `SR` binding is marked **`"remote": true`** in `wrangler.jsonc`, so every machine reads/writes the *same* production KV namespace |

So: import/study on the company machine → OneDrive syncs the code and KV holds the progress →
log in at home and the servers are already running, on the same content and review schedule.

> ⚠️ **Never add `--remote` to the launcher.** It looks like the flag that makes KV sync — it isn't.
> Syncing comes from `"remote": true` on the `SR` binding in `wrangler.jsonc`, which keeps the Worker
> running *locally* while KV stays production. `--remote` instead moves the whole Worker onto
> Cloudflare's preview edge, whose session token expires after a while; the hidden process then stops
> serving `:8788` **without exiting and without logging an error**. The symptom is
> `ERR_CONNECTION_REFUSED` on a site that "was working an hour ago", usually noticed right after an
> import — which is a coincidence of timing, not the cause. (This was the bug: `wrangler.jsonc` had
> been migrated to remote bindings but `tools/aws-learning-background.vbs` still passed `--remote`.)

> Note: the git `origin` points at the private backup repo (`Dattrong0512/aws-learning`).
> OneDrive + KV remains the primary sync path between machines; `git push` is for backup/history.
> Secrets never go in the repo — Cloudflare auth is via `npx wrangler login`, and any future real
> secret goes in via `npx wrangler secret put`. `Deploy AWS Learning.cmd` (optional) only
> publishes the site to its public Cloudflare URL for phone/browser review.

---

## The one rule that matters: `data-track`

Every trackable study item is a toggle whose title carries a `data-track` attribute:

```html
<details class="topic" data-track="EC2 networking, Security Groups & IAM"
         data-progress-aliases="Security Groups|Elastic IP|Elastic Network Interfaces (ENI)">
  <summary><span class="t-title">EC2 networking, Security Groups & IAM</span></summary>
  <div class="body">
    ... content ...
  </div>
</details>
```

- **`data-track="…"` is the tracking key.** It links the toggle to its spaced-repetition record.
- The value must be **unique across the whole page** and should match the `<summary>` text.
- **`data-progress-aliases` preserves old tracking keys after grouping.** Separate legacy titles
  with `|`. The worker migrates the most urgent old review record into the canonical topic once,
  retains the old records with `mergedInto`, and never postpones an existing review.
- **No `data-track` → not tracked.** A toggle without it renders but never enters the review schedule.

### Auto-import (how new toggles get tracked)

You do **not** edit the `SEED` array to add topics. On every page load the client scans all
`[data-track]` elements and `POST`s their title, section and aliases to `/api/sync`. The worker adds
a genuinely **new** title as `🆕 Mới`; grouped topics instead aggregate compatible legacy state.
Merged legacy records remain stored for rollback/audit but no longer inflate due counters.

> So: **add a toggle with a fresh `data-track`, deploy, open the page once → it's now in the schedule.**

---

## Import from lecture images (🖼️ "Nhập ảnh" feature)

The site can turn screenshots of lectures into study toggles using a selectable Claude or Codex
coding agent. Because a Cloudflare
Worker can't spawn a terminal, a tiny local companion server (`tools/builder.mjs`) does the work.

**How to use it:**

1. Run both servers from the project root:
   ```bash
   npx wrangler dev            # serves the site at http://localhost:8788
   node tools/builder.mjs      # companion server at http://localhost:47450
   ```
2. Open **http://localhost:8788** (must be `http://localhost` — the browser blocks calls to the
   local builder from an `https://` deployed page).
3. **Double-click** the `🖼️ Nhập ảnh` icon in the top bar.
4. Paste lecture images (Ctrl+V), drag-drop, or pick files.
5. Choose an existing page (IAM / EC2 / …) or `➕ Trang mới` and type a new page name.
6. Click **🚀 Tạo nội dung**, then choose an agent: **Codex** is the default
   (`gpt-5.6-terra` with high reasoning); **Claude** uses `claude-opus-4-8`.

Optional Udemy shortcut: load `tools/aws-capture-extension/` once from
`chrome://extensions` (**Developer mode → Load unpacked**). While a Udemy lesson is focused,
press backtick (`` ` ``) to capture the visible video frame directly into this import modal.
Normal mode crops to the player; fullscreen captures the whole visible player. Chrome keeps the
extension running, and opens the local AWS Learning tab in the background if needed. Success is
acknowledged only after the image is persisted: the Udemy toast shows the batch count and the import
modal shows the latest capture number and time.

The builder saves the images to `tools/inbox/<page>-<timestamp>/`, writes a prompt, and opens a
**new PowerShell window** running the selected CLI. Claude runs
`claude -p --model claude-opus-4-8 --permission-mode acceptEdits`; Codex runs
`codex exec --model gpt-5.6-terra -c model_reasoning_effort="high"` in full-access mode.
The selected agent interprets every image in the batch together, merges related material into an
existing major topic when possible, and edits `public/index.html`. Before the agent starts, the
builder saves `index.before.html`; after it finishes, `tools/validate-import.mjs` checks the result.
An agent/validation failure restores the backup and skips deployment. A valid result is deployed,
then the target page's saved content snapshot is cleared so source content becomes authoritative.

**When an agent is invoked by the builder, its prompt already instructs it to:** treat all screenshots
as one conceptual context, reorganize rather than transcribe, merge by AWS service, preserve the
matching topic's `data-track`, include **Mục đích** and practical **Use cases**, retain useful
comparison tables and exact technical values, interpret diagrams, avoid cheat-sheet sections,
validate the HTML, and edit only `public/index.html`.

- `BUILDER_DRYRUN=1 node tools/builder.mjs` saves images + prompt but skips launching the selected agent (for testing).
- Config lives at the top of `public/index.html` (`BUILDER_PORTS`) and `tools/builder.mjs` (`PORTS`, `MODEL`).
  The builder listens on **47450** (IANA dynamic range — not a registered service port, so it doesn't
  clash with other dev tools) and falls back to 47451–47453 if that one is busy. The page probes
  `/health` on the same list and uses whichever answers `service: "aws-learning-builder"`, so the two
  never need to agree on a single fixed port. To force a port: `BUILDER_PORT=48000 node tools/builder.mjs`
  (then add it to `BUILDER_PORTS` in `public/index.html`).

---

## How to import or update content manually

First find the matching major service/topic and update its body. Add another toggle only when the
material is genuinely distinct. Aim for roughly 3–6 major toggles per page (S3 may need more).

Sections and their `data-sec` / `data-track` section keys:

| `data-sec` | Section key (shown on cards) |
|------------|------------------------------|
| `iam`      | `IAM`                        |
| `ec2`      | `EC2`                        |
| `ebs`      | `EBS`                        |
| `alb`      | `ALB & ASG`                  |

### Steps

1. Find the target section by its `data-sec` in `public/index.html`.
2. Prefer updating an existing top-level topic. A genuinely new one looks like:

```html
<details class="topic" data-track="Amazon EFS" data-progress-aliases="">
  <summary><span class="t-title">Amazon EFS</span></summary>
  <div class="body">
    <p><strong>Mục đích:</strong> ...</p>
    <ul>...</ul>
    <p><strong>Use cases:</strong></p>
    <ul>...</ul>
  </div>
</details>
```

3. Give a new topic a unique `data-track` and `data-progress-aliases=""`. When consolidating old
   topics, list every replaced old key in `data-progress-aliases` exactly once.
4. Deploy (`npx wrangler deploy`) and open the site once so `/api/sync` registers it.

### Topic granularity

Do not turn each screenshot or small feature into another tracked/nested toggle. Use normal
`<h3>`, `<h4>`, paragraphs, lists and focused tables inside the major service toggle. For example,
SNS filtering, FIFO and SNS+SQS normally belong inside one `Amazon SNS` topic.

### Content formatting conventions (inside `.body`)

Match the existing page style:
- `<h3>` / `<h4>` for headings
- `<p>` for prose, `<ul>/<li>` for bullets
- `<table>…<tr><td>` for comparisons (see existing port/type tables)
- `<pre><code>…</code></pre>` for commands / config
- `<blockquote>` only where a warning or architectural constraint materially benefits from it
- `<hr>` to separate blocks
- Write content in **Vietnamese** to match the rest of the site.
- Start major services with `<p><strong>Mục đích:</strong> ...</p>`.
- Include `<p><strong>Use cases:</strong></p>` with concrete architecture-oriented examples.
- Match the richer existing-topic rhythm: Mục đích + a compact 4–8 bullet overview, descriptive
  `<h3>` sections for substantial concepts, and `<h4>` for mechanisms/constraints/sub-comparisons.
  Integrate the old summary instead of repeating it before a second detailed explanation.
- Keep exact source values such as limits, percentages, timeouts, throughput, IOPS, sizes, ports,
  supported modes/families and AZ/Region scope. Do not collapse a useful comparison table into
  generic prose merely to shorten a grouped topic.
- Treat legible table cells, diagram annotations, footnotes and exceptions as source facts that
  must be represented in the rewritten topic, not discarded after extracting only the headline.
- Do not add “Dấu hiệu đề thi”, keyword lists, “Mẹo nhớ” or hidden full-explanation wrappers.

---

## Adding a whole new section (less common)

1. Add a nav card + a `<section id="sec-xxx">` with `<div class="content" data-sec="xxx">` in the HTML.
2. Add the section to the `SECTIONS` array in the page JS (`{hash:"xxx", key:"Xxx", …}`) so the
   `data-sec` → section-key mapping and the summary cards work.
3. Toggles inside it auto-register as usual.

---

## Spaced-repetition model (reference)

- Intervals: `1 → 3 → 7 → 16 → 35 → ×2…` (`INTERVALS` + `nextInterval` in `src/worker.js`).
- Status by interval: `0 🆕 Mới`, `1–3 📖 Đang học`, `7–16 🔁 Ôn lại`, `≥35 ✅ Thuộc`.
- Dates use **UTC+7 (Vietnam)**. A cron at 22:00 UTC (05:00 VN) recomputes which toggles are "due".
- Marking an item learned (`POST /api/review`) advances its interval and reschedules `next`.

### API endpoints

| Method & path        | Purpose                                                              |
|----------------------|---------------------------------------------------------------------|
| `GET  /api/state`    | Current SR state (read-only).                                        |
| `POST /api/sync`     | Send `{toggles:[{title,section,aliases}]}` → add/migrate topics.    |
| `POST /api/review`   | `{learned:[title,…]}` → advance interval / reschedule.              |
| `GET/POST /api/content` | Live page edits persisted in KV (`content-v1`).                  |
| `POST /api/reset`    | Reseed SR state from `SEED`.                                         |

---

## Gotcha: live edits vs. source imports

The page supports in-browser editing (`/api/content` uses KV key `content-v1`). Content snapshots now
carry schema `grouped-v2`; older fragmented/compact snapshots are ignored so they cannot overwrite
the refactored source. Spaced-repetition state lives in a separate KV key and is not reset by this
content schema. After a successful screenshot import, the builder clears only the target section's
content snapshot; `/api/sync` then preserves or migrates review progress through tracking aliases.

---

## Deploy

```bash
npx wrangler deploy      # deploy worker + static assets
npx wrangler dev         # local preview
```

After deploying new toggles, load the page once so `/api/sync` imports them into the schedule.
