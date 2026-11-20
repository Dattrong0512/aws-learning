import assert from "node:assert/strict";
import test from "node:test";
import { createStudyPrompt, createStudyBatches } from "./build-study-prompt.mjs";

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

test("preserves useful comparisons and decision-relevant exact facts", () => {
  const value = prompt({ files: ["comparison-table.png"] });
  assert.match(value, /Preserve comparison\/specification tables/);
  assert.match(value, /Keep exact technical facts that affect the correct answer/);
  assert.match(value, /throughput, IOPS, bandwidth, ports/);
  assert.match(value, /There is no hard word cap/);
  assert.match(value, /Remove repetition, not useful facts/);
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
  assert.match(value, /compact block style of the Disaster Recovery and KMS pages/);
  assert.match(value, /consecutively numbered <h3> blocks separated by <hr>/);
  assert.match(value, /A heading contains only its short label, never paragraphs/);
  assert.match(value, /No required word count or overview bullet count/);
  assert.match(value, /one feature per line/);
  assert.match(value, /Put flow arrows\n  on separate lines/);
  assert.match(value, /For formatting-only tasks, change only older prose-heavy content/);
  assert.match(value, /leave already matching\n  topics unchanged, including their saved bodies/);
  assert.doesNotMatch(value, /450–1,200|4–8 bullet overview/);
  assert.match(value, /Do not leave a generic summary followed by a second version/);
});

test("reads annotations and retains exam-relevant distinctions without transcription", () => {
  const value = prompt({ files: ["annotated-table.png", "architecture.png"] });
  assert.match(value, /Inspect all source table\/diagram annotations/);
  assert.match(value, /retain the distinctions necessary for\n  SAA-C03/);
  assert.match(value, /Do not copy every legible row/);
  assert.match(value, /repeated footer summaries/);
});

test("keeps security facts in service topics after removal of the access-reference page", () => {
  const value = prompt({ section: "Serverless", sectionHash: "serverless", files: ["lambda.png"] });
  assert.match(value, /ACCESS AND ENCRYPTION WITHIN EACH TOPIC/);
  assert.match(value, /For every AWS service added or materially updated/);
  assert.match(value, /separate access-reference page has been removed; do not recreate it/);
  assert.match(value, /control-plane IAM from data-plane access/);
  assert.match(value, /at-rest mechanism\/KMS relationship/);
  assert.doesNotMatch(value, /data-sec="manageaccess"|add or update its[\s\S]*matching row/);
});

test("supports creating a new destination page", () => {
  const value = prompt({ section: "Serverless", sectionHash: "serverless", isNew: true, files: ["lambda.png"] });
  assert.match(value, /NEW page named "Serverless"/);
  assert.match(value, /sec-serverless/);
  assert.match(value, /matching SECTIONS entry/);
});

test("splits images into batches of 25 without loss and merges across batch boundaries", () => {
  for (const [count, sizes] of [[1,[1]], [25,[25]], [26,[25,1]], [71,[25,25,21]], [100,[25,25,25,25]]]) {
    const files = Array.from({length:count}, (_,i)=>`${i+1}.png`);
    const batches = createStudyBatches({section:"VPC",sectionHash:"vpc",isNew:true,dir:"C:/inbox",files,note:"Giữ bảng so sánh"});
    assert.deepEqual(batches.map(b=>b.files.length), sizes);
    assert.deepEqual(batches.flatMap(b=>b.files), files);
    assert.match(batches[0].prompt, /NEW page named/);
    for (const batch of batches) assert.match(batch.prompt, /Giữ bảng so sánh/);
    if (batches.length > 1) {
      assert.match(batches[1].prompt, /EXISTING page/);
      assert.match(batches[1].prompt, /Preserve earlier essential facts, useful tables, decision-relevant exact values/);
      assert.match(batches.at(-1).prompt, /FINAL batch[\s\S]*consolidate repeated concepts across batches/);
      assert.match(batches.at(-1).prompt, /Batch boundaries MUST NOT determine topic boundaries/);
    }
  }
});
