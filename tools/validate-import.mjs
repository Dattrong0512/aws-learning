import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const sections = [...html.matchAll(/<section class="section" id="sec-([^"]+)">/g)];
assert.ok(sections.length >= 12, "existing category/page was removed");

const tracks = [...html.matchAll(/data-track="([^"]+)"/g)].map((match) => match[1]);
assert.ok(tracks.length > 0, "no study topics found");
assert.equal(new Set(tracks).size, tracks.length, "duplicate data-track values found");

for (const tag of html.matchAll(/<details class="topic"([^>]*)>/g)) {
  const nextTag = html.indexOf("</details>", tag.index);
  const block = html.slice(tag.index, nextTag + 10);
  assert.match(block, /<summary><span class="t-title">[^<]+<\/span><\/summary>/, "topic summary/title missing");
  assert.match(block, /<div class="body">/, "topic body missing");
}

for (const forbidden of ["Xem giải thích đầy đủ", "Dấu hiệu đề thi", "Keyword đề thi", "Mẹo nhớ", "Thấy X chọn Y"]) {
  assert.equal(html.includes(forbidden), false, `forbidden cheat-sheet phrase found: ${forbidden}`);
}

const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, "inline JavaScript missing");
new Function(script);

console.log(`Import validation passed: ${sections.length} sections, ${tracks.length} unique topics.`);
