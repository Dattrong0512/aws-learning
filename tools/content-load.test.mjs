import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function inlineFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in the production inline script`);
  const brace = html.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < html.length; i += 1) {
    if (html[i] === "{") depth += 1;
    if (html[i] === "}") depth -= 1;
    if (depth === 0) {
      const source = html.slice(start, i + 1);
      return Function(`"use strict"; ${source}; return ${name};`)();
    }
  }
  throw new Error(`Could not extract ${name}`);
}

const fakeTopic = (title, aliases = "") => ({
  title,
  aliases,
  removed: false,
  getAttribute(name) {
    if (name === "data-track") return this.title;
    if (name === "data-progress-aliases") return this.aliases;
    return null;
  },
  remove() { this.removed = true; },
});

test("removes saved legacy service toggles represented by canonical progress aliases", () => {
  const removeMergedAliasTopics = inlineFunction("removeMergedAliasTopics");
  const sourceTopics = [
    fakeTopic("Amazon ECS – Orchestration, tasks và services", "ECS – Auto Scaling service và capacity EC2"),
    fakeTopic("AWS Fargate"),
    fakeTopic("Amazon ECR", "ECR – Kho image, pull và bảo mật"),
    fakeTopic("Amazon EKS", "EKS – Kiến trúc Kubernetes đa AZ|EKS – Node groups và persistent volumes"),
  ];
  const savedTopics = [
    fakeTopic("ECS – Auto Scaling service và capacity EC2"),
    fakeTopic("ECR – Kho image, pull và bảo mật"),
    fakeTopic("EKS – Kiến trúc Kubernetes đa AZ"),
    fakeTopic("EKS – Node groups và persistent volumes"),
    fakeTopic("A separate topic"),
  ];
  const container = { querySelectorAll: () => savedTopics };

  assert.equal(removeMergedAliasTopics(container, sourceTopics), 4);
  assert.deepEqual(
    savedTopics.filter((topic) => !topic.removed).map((topic) => topic.title),
    ["A separate topic"],
  );
});

test("loadContent applies alias cleanup after loading a saved section", () => {
  const body = html.slice(html.indexOf("async function loadContent()"), html.indexOf("/* ===================== Import lecture images", html.indexOf("async function loadContent()")));
  assert.match(body, /removeMergedAliasTopics\(d,\s*srcTopics\)/);
});

test("container service fragments are folded into the four canonical topics", () => {
  const start = html.indexOf('<section class="section" id="sec-ecsfargateecreks">');
  const end = html.indexOf('<section class="section" id="sec-severlessoverview">', start);
  const section = html.slice(start, end);
  const tracks = [...section.matchAll(/data-track="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(tracks, [
    "Amazon ECS – Orchestration, tasks và services",
    "AWS Fargate",
    "Amazon ECR",
    "Amazon EKS",
  ]);
  assert.match(section, /data-track="Amazon ECS[^>]+data-progress-aliases="ECS – Auto Scaling service và capacity EC2"/);
  assert.match(section, /data-track="Amazon ECR"[^>]+data-progress-aliases="ECR – Kho image, pull và bảo mật"/);
  assert.match(section, /data-track="Amazon EKS"[^>]+data-progress-aliases="EKS – Kiến trúc Kubernetes đa AZ\|EKS – Node groups và persistent volumes"/);
  assert.match(section, /targetCapacity/);
  assert.match(section, /ECR VPC endpoints/);
  assert.match(section, /StorageClass[^<]*<strong>CSI driver<\/strong>/);
});
