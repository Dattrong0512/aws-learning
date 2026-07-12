# AWS Learning — Import & Tracking Guide (for Claude)

A Cloudflare Worker that serves a Notion-style single-page study site (`public/index.html`)
with a built-in **spaced-repetition** tracker (state stored in Workers KV, namespace `SR`).

- `public/index.html` — the whole study page (content + UI + client JS).
- `src/worker.js` — API + cron + static serving. Holds the initial `SEED` and the SR algorithm.
- Content is organized into **sections**; each study item is a **toggle** (`<details>`).

---

## Run it & sync between machines (company ↔ home)

**One double-click:** open **`AWS Learning`** (the icon in this folder, or on the Desktop).
It runs `Start AWS Learning.cmd`, which launches two windows — the content builder and
`wrangler dev --remote` — and opens the site at `http://localhost:8787`.

**First-time setup on each machine (one-off):**
1. Install [Node.js](https://nodejs.org) and Claude Code (the `claude` CLI must be on `PATH`).
2. `npx wrangler login` (needed once so `--remote` can reach your Cloudflare account).
3. Double-click **`Create Desktop Icon.cmd`** to generate the `AWS Learning` shortcut with an icon.

**How the two things sync — no manual copying:**

| What | Where it lives | How it syncs |
|------|----------------|--------------|
| Learning content (toggles in `index.html`) | This folder | **OneDrive** — same folder on both machines |
| Review progress (intervals, due dates) | Cloudflare **KV** (`SR`) | **`wrangler dev --remote`** uses the *same* production KV namespace everywhere (`id` = `preview_id` in `wrangler.jsonc`) |

So: import/study on the company machine → OneDrive syncs the code and KV holds the progress →
open `AWS Learning` at home and you're on the same content and the same review schedule.

> ⚠️ Use the launcher (`wrangler dev **--remote**`), **not** plain `wrangler dev`. Plain dev uses an
> isolated *local* KV that would NOT sync — progress would diverge between machines.

> Note: the git `origin` points at the private backup repo (`Dattrong0512/aws-learning`).
> OneDrive + KV remains the primary sync path between machines; `git push` is for backup/history.
> Secrets never go in the repo — Cloudflare auth is via `npx wrangler login`, and any future real
> secret goes in via `npx wrangler secret put`. `Deploy AWS Learning.cmd` (optional) only
> publishes the site to its public Cloudflare URL for phone/browser review.

---

## The one rule that matters: `data-track`

Every trackable study item is a toggle whose title carries a `data-track` attribute:

```html
<details class="topic" data-track="EC2 Security Groups">
  <summary>EC2 Security Groups</summary>
  <div class="body">
    ... content ...
  </div>
</details>
```

- **`data-track="…"` is the tracking key.** It links the toggle to its spaced-repetition record.
- The value must be **unique across the whole page** and should match the `<summary>` text.
- **No `data-track` → not tracked.** A toggle without it renders but never enters the review schedule.

### Auto-import (how new toggles get tracked)

You do **not** edit the `SEED` array to add topics. On every page load the client scans all
`[data-track]` elements and `POST`s them to `/api/sync`. The worker adds any **new** title to the
KV database as `🆕 Mới` (interval 0, due today) so spaced repetition starts tracking it immediately.
Existing titles are left untouched.

> So: **add a toggle with a fresh `data-track`, deploy, open the page once → it's now in the schedule.**

---

## Import from lecture images (🖼️ "Nhập ảnh" feature)

The site can turn screenshots of lectures into study toggles using Claude. Because a Cloudflare
Worker can't spawn a terminal, a tiny local companion server (`tools/builder.mjs`) does the work.

**How to use it:**

1. Run both servers from the project root:
   ```bash
   npx wrangler dev            # serves the site at http://localhost:8787
   node tools/builder.mjs      # companion server at http://localhost:4545
   ```
2. Open **http://localhost:8787** (must be `http://localhost` — the browser blocks calls to the
   local builder from an `https://` deployed page).
3. **Double-click** the `🖼️ Nhập ảnh` icon in the top bar.
4. Paste lecture images (Ctrl+V), drag-drop, or pick files.
5. Choose an existing page (IAM / EC2 / …) or `➕ Trang mới` and type a new page name.
6. Click **🚀 Tạo nội dung**.

The builder saves the images to `tools/inbox/<page>-<timestamp>/`, writes a prompt, and opens a
**new PowerShell window** running `claude -p --model claude-opus-4-8 --permission-mode acceptEdits`.
Claude reads the images and adds toggles to that page in `public/index.html` (recreating diagrams as
HTML/SVG, concise-but-exam-complete Vietnamese for SAA-C03). When Claude finishes successfully, the
same window automatically runs **`npx wrangler deploy`** to publish the new content to Cloudflare
(skipped if Claude fails). Then **reload the site** — `/api/sync` registers the new toggles into the
review schedule automatically.

**When Claude is invoked by the builder, its prompt already instructs it to:** read `CLAUDE.md`,
read every image, add one toggle per concept with a unique `data-track`, recreate diagrams/tables as
code, write concise Vietnamese SAA-C03 content, and edit only `public/index.html`. Follow those
instructions and the conventions below.

- `BUILDER_DRYRUN=1 node tools/builder.mjs` saves images + prompt but skips launching Claude (for testing).
- Config lives at the top of `public/index.html` (`BUILDER_URL`) and `tools/builder.mjs` (`PORT`, `MODEL`).

---

## How to import content (manually)

To import a new study item, add a toggle into the right section's `<div class="content" data-sec="…">`.

Sections and their `data-sec` / `data-track` section keys:

| `data-sec` | Section key (shown on cards) |
|------------|------------------------------|
| `iam`      | `IAM`                        |
| `ec2`      | `EC2`                        |
| `ebs`      | `EBS`                        |
| `alb`      | `ALB & ASG`                  |

### Steps

1. Find the target section by its `data-sec` in `public/index.html`.
2. Add a **top-level topic toggle** inside that `div.content`:

```html
<details class="topic" data-track="Amazon EFS – Elastic File System">
  <summary>Amazon EFS – Elastic File System</summary>
  <div class="body">
    <h3>EFS là gì?</h3>
    <p>...</p>
  </div>
</details>
```

3. Give it a **unique** `data-track` (this is the review-schedule key — do not reuse an existing one).
4. Deploy (`npx wrangler deploy`) and open the site once so `/api/sync` registers it.

### Nested sub-toggles

A topic can contain sub-toggles. Each sub-toggle can **also** be tracked independently — just give it
its own unique `data-track`:

```html
<details class="topic" data-track="EBS Volume Types">
  <summary>EBS Volume Types</summary>
  <div class="body">
    <details class="sub" data-track="EBS – gp3 vs gp2">
      <summary>gp3 vs gp2</summary>
      <div class="body">...</div>
    </details>
  </div>
</details>
```

Use `class="topic"` for section-level items and `class="sub"` for nested ones.

### Content formatting conventions (inside `.body`)

Match the existing page style:
- `<h3>` / `<h4>` for headings
- `<p>` for prose, `<ul>/<li>` for bullets
- `<table>…<tr><td>` for comparisons (see existing port/type tables)
- `<pre><code>…</code></pre>` for commands / config
- `<blockquote>` for tips / "ghi nhớ" notes
- `<hr>` to separate blocks
- Write content in **Vietnamese** to match the rest of the site.

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
| `POST /api/sync`     | Send `{toggles:[{title,section}]}` → **auto-imports new toggles**.   |
| `POST /api/review`   | `{learned:[title,…]}` → advance interval / reschedule.              |
| `GET/POST /api/content` | Live page edits persisted in KV (`content-v1`).                  |
| `POST /api/reset`    | Reseed SR state from `SEED`.                                         |

---

## Gotcha: live edits vs. source imports

The page supports in-browser editing (`/api/content` saves each section's HTML to KV, key `content-v1`).
On load, saved KV content **replaces** the source HTML for that section. To keep imports reliable,
`loadContent()` re-injects any **top-level** source toggle whose `data-track` is missing from the KV
snapshot — so a topic you add to `index.html` still shows even if the section was previously edited live.

Caveats:
- A re-injected toggle is appended at the **end** of its section (position from source isn't preserved).
- This only rescues **top-level** topics. If you add a **sub-toggle** inside a topic that has a saved KV
  snapshot, it may be hidden. In that case either add it via the live editor, or `POST /api/reset` is not
  enough (that only resets SR state) — clear/overwrite the section's `content-v1` entry instead.

---

## Deploy

```bash
npx wrangler deploy      # deploy worker + static assets
npx wrangler dev         # local preview
```

After deploying new toggles, load the page once so `/api/sync` imports them into the schedule.
