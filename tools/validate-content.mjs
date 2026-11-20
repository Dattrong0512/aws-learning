import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { messages } from "../src/client/i18n.mjs";
const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const expectedCounts = {
  iam: 4,
  ec2: 5,
  ebs: 3,
  alb: 6,
  rdsauroraelasticcache: 6,
  databases: 4,
  route53: 4,
  s3: 8,
  awsstorageextras: 5,
  cloudfrontawsglobalaccel: 4,
  sqssnskinesisactivemq: 6,
  ecsfargateecreks: 4,
  severlessoverview: 7,
  dataanalytics: 9,
  machinelearning: 6,
  awsmonitoringauditcloudw: 5,
  iamadvanced: 6,
  awssecurityencryptionkms: 7,
  networkingvpc: 5,
  disasterrecoverymigratio: 7,
  whitepaperandarchitectur: 2,
  otherservices: 11,
};
const tracksByLanguage = [];
for (const lang of ["vi", "en"]) {
  const html = read(lang === "vi" ? "public/index.html" : "public/en/index.html");
  assert.match(html, new RegExp(`<html lang="${lang}">`));
  assert.match(html, /src="\/assets\/app\.mjs"/);
  assert.ok(!/contenteditable|draggable|href="\/Exam\/|>AWS:\s|\{\{/i.test(html), `${lang}: editor, citation or unresolved template remains`);
  const sections = [...html.matchAll(/<section class="section" id="sec-([^"]+)">/g)];
  assert.deepEqual(sections.map(x=>x[1]).sort(), Object.keys(expectedCounts).sort());
  const tracks = [];
  for (let i=0;i<sections.length;i++) {
    const key = sections[i][1];
    const block = html.slice(sections[i].index, sections[i+1]?.index ?? html.indexOf('<script src='));
    const topics = [...block.matchAll(/<details class="topic"([^>]*)>/g)];
    assert.equal(topics.length, expectedCounts[key], `${lang}/${key}: topic count changed`);
    for (const topic of topics) {
      const track = topic[1].match(/data-track="([^"]+)"/)?.[1];
      assert.ok(track, `${lang}/${key}: missing topic ID`); tracks.push(track);
      const value = block.slice(topic.index,block.indexOf('</details>',topic.index));
      assert.match(value, /<summary><span class="t-title">[^<]+<\/span><\/summary>/);
      assert.match(value, new RegExp(`<strong>${lang === "vi" ? "Mục đích" : "Purpose"}:<\/strong>`));
      assert.match(value, /<h[34]\b/);
      assert.doesNotMatch(value.slice(value.indexOf('<div class="body">')), /<details\b/);
    }
  }
  assert.equal(tracks.length,124); assert.equal(new Set(tracks).size,124);
  tracksByLanguage.push(tracks);
  const catalog = JSON.parse(html.match(/<script id="catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(catalog.length,22);
}
assert.deepEqual(tracksByLanguage[0],tracksByLanguage[1],"Languages must share the same stable topic IDs");
assert.deepEqual(Object.keys(messages.vi).sort(),Object.keys(messages.en).sort());
for (const file of readdirSync(new URL("../src/client/",import.meta.url))) {
  const code=read(`src/client/${file}`);
  assert.doesNotMatch(code,/contentEditable|saveContent|sendBeacon|fetch\(["']\/api\//);
  assert.equal(code,read(`public/assets/${file}`),`${file}: rebuild the site`);
}
assert.equal(existsSync(new URL("../public/Exam/",import.meta.url)),false);
assert.equal(existsSync(new URL("../public/all.html",import.meta.url)),false);
console.log("Content validation passed: two languages, 22 sections, 124 topics, read-only assets.");
