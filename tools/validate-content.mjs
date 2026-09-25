import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const decode = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

const expectedCounts = {
  iam: 4,
  ec2: 4,
  ebs: 3,
  alb: 6,
  rdsauroraelasticcache: 6,
  databases: 3,
  route53: 4,
  s3: 8,
  awsstorageextras: 5,
  cloudfrontawsglobalaccel: 4,
  sqssnskinesisactivemq: 6,
  ecsfargateecreks: 4,
  severlessoverview: 6,
  dataanalytics: 8,
  machinelearning: 6,
  awsmonitoringauditcloudw: 4,
  manageaccess: 0,
};

const sectionMatches = [...html.matchAll(/<section class="section" id="sec-([^"]+)">/g)];
assert.deepEqual(sectionMatches.map((match) => match[1]), Object.keys(expectedCounts), "section order/list changed");

const allTracks = [];
const coveredLegacyKeys = [];
for (let index = 0; index < sectionMatches.length; index++) {
  const match = sectionMatches[index];
  const sectionId = match[1];
  const end = index + 1 < sectionMatches.length
    ? sectionMatches[index + 1].index
    : html.indexOf('<div class="toast"', match.index);
  const block = html.slice(match.index, end);
  const detailTags = [...block.matchAll(/<details class="topic"([^>]*)>/g)];
  assert.equal(detailTags.length, expectedCounts[sectionId], `${sectionId}: unexpected topic count`);

  for (const detail of detailTags) {
    const attrs = detail[1];
    const title = decode(attrs.match(/data-track="([^"]+)"/)?.[1] || "");
    assert.ok(title, `${sectionId}: topic missing data-track`);
    allTracks.push(title);

    if (sectionId !== "ecsfargateecreks" && sectionId !== "manageaccess") {
      const topicEnd = block.indexOf("</details>", detail.index);
      const topicBlock = block.slice(detail.index, topicEnd + 10);
      assert.match(topicBlock, /<strong>Mục đích:/, `${sectionId}: ${title} needs Mục đích`);
      assert.match(topicBlock, /<strong>Use cases:/, `${sectionId}: ${title} needs Use cases`);
    }

    const aliasMatch = attrs.match(/data-progress-aliases="([^"]*)"/);
    if (aliasMatch) {
      coveredLegacyKeys.push(...decode(aliasMatch[1]).split("|").map((item) => item.trim()).filter(Boolean));
    } else {
      coveredLegacyKeys.push(title);
    }
  }

}

assert.equal(allTracks.length, 81, "total topic count must remain at the refactored baseline");
assert.equal(new Set(allTracks).size, allTracks.length, "data-track values must be unique");
assert.equal(coveredLegacyKeys.length, 239, "all original, imported and historical grouped progress keys must be mapped exactly once");
assert.equal(new Set(coveredLegacyKeys).size, coveredLegacyKeys.length, "legacy progress aliases must be unique");

for (const forbidden of ["Xem giải thích đầy đủ", "Dấu hiệu đề thi", "Keyword đề thi", "Mẹo nhớ", "Thấy X chọn Y"]) {
  assert.equal(html.includes(forbidden), false, `forbidden cheat-sheet phrase remains: ${forbidden}`);
}

assert.match(html, /const CONTENT_SCHEMA="grouped-v2"/);
assert.doesNotMatch(html, /loadContent\(\)\.then\([^\r\n]*(applyCheatSheets|groupTopics|groupAllRemainingTopics)\(/);

const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert.ok(script, "inline script missing");
new Function(script);

const normalized = html.replace(/\r\n/g, "\n");
const ecsMarker = '<section class="section" id="sec-ecsfargateecreks">';
const serverlessMarker = '<section class="section" id="sec-severlessoverview">';
const accessMarker = '<section class="section" id="sec-manageaccess">';
const suffixMarker = '\n</div>\n\n<div class="toast"';
const ecsStart = normalized.indexOf(ecsMarker);
const serverlessStart = normalized.indexOf(serverlessMarker, ecsStart);
const accessStart = normalized.indexOf(accessMarker, serverlessStart);
const suffixStart = normalized.indexOf(suffixMarker, accessStart);
const shortHash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
assert.equal(shortHash(normalized.slice(ecsStart, serverlessStart)), "57dbe5d171cf", "ECS page changed unexpectedly");
assert.equal(shortHash(normalized.slice(serverlessStart, accessStart)), "304ce7bc6911", "Serverless page changed unexpectedly");
assert.equal(shortHash(normalized.slice(accessStart, suffixStart)), "d3a2a29fb35c", "Manage Access page changed unexpectedly");

console.log(`Content validation passed: ${sectionMatches.length} sections, ${allTracks.length} topics, 190 original + 49 imported/historical progress keys mapped.`);
