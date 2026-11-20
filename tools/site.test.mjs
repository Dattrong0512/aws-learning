import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { messages, translate } from "../src/client/i18n.mjs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const catalog = JSON.parse(read("content/catalog.json"));

test("both languages contain the complete handbook with shared identities and structure", () => {
  assert.equal(catalog.length,22);
  for (const section of catalog) {
    const vi=read(`content/vi/${section.hash}.html`), en=read(`content/en/${section.hash}.html`);
    for (const attribute of ["data-track", "data-progress-aliases"]) {
      const values = html => [...html.matchAll(new RegExp(`${attribute}="([^\"]*)"`,"g"))].map(match=>match[1]);
      assert.deepEqual(values(vi),values(en),`${section.hash}: changed topic identity`);
    }
    for (const tag of ["details","h3","h4","table","tr","td","th","pre","li"]) {
      const count = html => [...html.matchAll(new RegExp(`<${tag}(?:\\s|>)`,"g"))].length;
      assert.equal(count(vi),count(en),`${section.hash}: missing ${tag} content`);
    }
    const text=en.replace(/<[^>]*>/g,"");
    assert.ok(!/[ĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]/.test(text),`${section.hash}: untranslated Vietnamese text`);
  }
});

test("Vietnamese is the default and English has a separate complete page", () => {
  const vi=read("public/index.html"), en=read("public/en/index.html");
  assert.match(vi,/<html lang="vi">/);
  assert.match(en,/<html lang="en">/);
  assert.match(vi,/data-language="en" href="\/en\/"/);
  assert.match(en,/data-language="vi" href="\/"/);
  assert.ok(!/contenteditable|draggable|\/api\/content/.test(vi+en));
  assert.equal(existsSync(new URL("../public/Exam/",import.meta.url)),false);
});

test("locale messages include every label and interpolate translated search counts", () => {
  assert.deepEqual(Object.keys(messages.vi).sort(),Object.keys(messages.en).sort());
  assert.equal(translate("vi","resultCount",3,2),"3 kết quả · 2 chuyên đề");
  assert.equal(translate("en","resultCount",3,2),"3 results · 2 sections");
  assert.equal(translate("en","searchIn","IAM"),"Search in IAM");
});

test("container lessons retain migrated compute modes, autoscaling and endpoints", () => {
  const html=read("content/vi/ecsfargateecreks.html");
  assert.deepEqual([...html.matchAll(/data-track="([^\"]+)"/g)].map(match=>match[1]),[
    "Amazon ECS – Orchestration, tasks và services", "AWS Fargate", "Amazon ECR", "Amazon EKS",
  ]);
  for(const fact of ["ECS Managed Instances","Karpenter","EKS Interface VPC Endpoint"]) assert.ok(html.includes(fact));
});
