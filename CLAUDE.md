# AWS Learning: content and architecture

Read `AGENTS.md` and `README.md` first. This is a read-only AWS SAA-C03 handbook
with 22 sections and 124 topics, published as Vietnamese `/` and English `/en/`.

## Source of truth

- Edit paired topic modules in `content/vi/` and `content/en/`.
- `content/catalog.json` holds stable section hashes/keys, architecture domains and
  localized names/descriptions. Each locale has its own `name` and `desc` value.
- `src/templates/page.html` and `section.html` render both languages; `ui.vi.json`
  and `ui.en.json` hold static interface labels.
- `src/client/app.mjs` initializes navigation and home cards; `navigation.mjs`
  owns routes and TOC; `search-core.mjs` owns search ranking; `search.mjs` renders
  results; `i18n.mjs` provides dynamic interface messages.
- `src/styles/site.css` is the shared stylesheet. `public/` is generated and ignored.

The migration preserved the effective Vietnamese content, including all saved KV
edits. Only trailing AWS citation links and decorative icons were removed.
Do not rewrite unrelated content or regenerate it from an older snapshot.

## Editing rules

- Preserve the existing flat major-topic structure, tables, flows and useful details.
- A topic uses `<details class="topic" data-track="..." data-progress-aliases="...">`,
  a summary with `.t-title` and a `.body`. Internal concepts use h3/h4 headings.
- `data-track` and aliases are stable identifiers. Keep them identical across
  languages, even when the visible English title is translated.
- Keep useful Vietnamese explanations concise. Preserve facts, conditions,
  numbers, comparisons, code and prerequisites. Never silently change the meaning.
- Maintain the complete English counterpart when updating Vietnamese content.
- Do not add decorative icons, trailing `AWS: ...` source links, cheat-sheet
  keyword lists or redundant summaries. Preserve existing content unless asked.
- New sections require paired content files and a catalog entry. Update expected
  section/topic counts in the build and validators when deliberately adding topics.

## Data and API safety

The browser has no editor, title editing, drag-and-drop or save requests.
`GET/HEAD /api/content` retains compatibility with the old `content-v1` snapshot;
all writes return `405`. Published pages use the static source, not that snapshot.
Keep the existing `SR` binding and namespace. Never reset, reseed, clear snapshots,
write KV, or remove saved review records as part of a deploy or content change.

The removed `/Exam` pages return `410`; `/all.html` redirects to `/`.
Do not restore their output as part of the site build.

The optional `tools/builder.mjs` is a local maintenance service, not a public API
or part of normal startup. It backs up content modules, builds and validates
changes, and restores source modules on failure. It must never clear KV snapshots.
Capture-extension sources are retained for historical/local maintenance only.

## Verification and deployment

```sh
node tools/build-site.mjs
node tools/validate-import.mjs
node --test tools/*.test.mjs
git diff --check
npx --yes wrangler@4.128.0 deploy
```

Run relevant checks, deploy after requested changes, and verify the changed pages
live. Exercise language switching with an active hash, search/TOC, keyboard controls
and mobile layout when changing frontend modules. Do not claim the custom domain
works until DNS, TLS and both locale pages have been verified.
