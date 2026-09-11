import assert from "node:assert/strict";
import test from "node:test";
import { createStudyPrompt } from "./build-study-prompt.mjs";

const prompt = (overrides = {}) => createStudyPrompt({
  section: "SQS, SNS, Kinesis, Active MQ",
  sectionHash: "sqssnskinesisactivemq",
  isNew: false,
  dir: "C:/inbox/batch",
  files: ["01.png", "02.png", "03.png", "04.png"],
  note: "",
  ...overrides,
});

test("processes multiple screenshots as one conceptual context", () => {
  const value = prompt();
  for (const file of ["01.png", "02.png", "03.png", "04.png"]) assert.match(value, new RegExp(file.replace(".", "\\.")));
  assert.match(value, /ALL images[\s\S]*ONE conceptual input/);
  assert.match(value, /Screenshot boundaries MUST NOT determine topic boundaries/);
  assert.match(value, /SNS overview\/filtering\/FIFO\/SNS\+SQS should normally update one Amazon SNS topic/);
});

test("merges a small feature into an existing major service topic", () => {
  const value = prompt({ files: ["sns-filtering.png"] });
  assert.match(value, /SNS Message Filtering.*belongs inside "Amazon SNS"/);
  assert.match(value, /keep its data-track unchanged/);
  assert.match(value, /Create a new toggle only for a genuinely distinct service\/concept/);
});

test("keeps distinct SQS and SNS services separate", () => {
  assert.match(prompt({ files: ["sqs.png", "sns.png"] }), /Images covering SQS and SNS should normally update two separate major service topics/);
});

test("passes the optional note as an instruction rather than study content", () => {
  const value = prompt({ section: "EBS", sectionHash: "ebs", files: ["gp.png"], note: "tập trung vào gp2 vs gp3" });
  assert.match(value, /OPTIONAL USER GENERATION INSTRUCTION/);
  assert.match(value, /tập trung vào gp2 vs gp3/);
  assert.match(value, /never copy this text into the notes/);
});

test("requires purpose, use cases and architecture interpretation", () => {
  const value = prompt({ files: ["architecture.png"] });
  assert.match(value, /<strong>Mục đích:<\/strong>/);
  assert.match(value, /<strong>Use cases:<\/strong>/);
  assert.match(value, /Interpret diagrams as architecture/);
  assert.match(value, /Do NOT create one topic per screenshot/);
});

test("preserves source tables and exact technical values", () => {
  const value = prompt({ files: ["comparison-table.png"] });
  assert.match(value, /Preserve comparison\/specification tables/);
  assert.match(value, /Never drop exact technical facts/);
  assert.match(value, /throughput, IOPS, bandwidth, ports/);
  assert.match(value, /There is no hard word cap/);
  assert.match(value, /remove repetition, not useful facts/);
});

test("requires future imports to match the current grouped-v2 HTML format", () => {
  const value = prompt({ files: ["new-service.png"] });
  assert.match(value, /MATCH THE CURRENT PAGE FORMAT EXACTLY/);
  assert.match(value, /inspect two or three neighboring topics/);
  assert.match(value, /current grouped-v2 notes/);
  assert.match(value, /<details class="topic" data-track="Canonical major topic" data-progress-aliases="">/);
  assert.match(value, /<summary><span class="t-title">Canonical major topic<\/span><\/summary>/);
  assert.match(value, /Keep the current flat list of major topic toggles/);
  assert.match(value, /preserve its current data-track, title and data-progress-aliases/);
  assert.match(value, /compact\n+  4–8 bullet overview/);
  assert.match(value, /one descriptive <h3> for each substantial source concept/);
  assert.match(value, /Do not leave a generic summary followed by a second version/);
});

test("accounts for every legible technical annotation in source tables and diagrams", () => {
  const value = prompt({ files: ["annotated-table.png", "architecture.png"] });
  assert.match(value, /every legible row, column, label, footnote, exception and numeric annotation/);
  assert.match(value, /never keep only the headline while silently dropping/);
});

test("requires an Access & Encryption quick-reference row for every touched service", () => {
  const value = prompt({ section: "Serverless", sectionHash: "serverless", files: ["lambda.png"] });
  assert.match(value, /ACCESS & ENCRYPTION QUICK-REFERENCE IS MANDATORY/);
  assert.match(value, /For every AWS service added or materially updated/);
  assert.match(value, /Bảng tra nhanh — Access & Encryption/);
  assert.match(value, /Service \| Access \/ Permission \| Encryption \|/);
  assert.match(value, /control-plane IAM from data-plane access/);
  assert.match(value, /at-rest mechanism\/KMS relationship/);
  assert.match(value, /Update an existing row instead of[\s\S]*adding a duplicate/);
});

test("supports creating a new destination page", () => {
  const value = prompt({ section: "Serverless", sectionHash: "serverless", isNew: true, files: ["lambda.png"] });
  assert.match(value, /NEW page named "Serverless"/);
  assert.match(value, /sec-serverless/);
  assert.match(value, /matching SECTIONS entry/);
});
