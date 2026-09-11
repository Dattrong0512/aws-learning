import { readFileSync } from "node:fs";
import { computeActiveDue, syncTrackedTopics } from "../src/progress.mjs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const decode = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&quot;", '"')
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");
const sectionNames = new Map([
  ["iam", "IAM"], ["ec2", "EC2"], ["ebs", "EBS"], ["alb", "ALB & ASG"],
  ["rdsauroraelasticcache", "RDS + Aurora + ElasticCache"], ["route53", "Route 53"],
  ["s3", "S3"], ["awsstorageextras", "AWS Storage Extras"],
  ["cloudfrontawsglobalaccel", "Cloud Front & AWS Global Accelerator"],
  ["sqssnskinesisactivemq", "SQS, SNS, Kinesis, Active MQ"],
  ["ecsfargateecreks", "ECS, Fargate, ECR & EKS"],
]);
const toggles = [];
for (const section of html.matchAll(/<div class="content" data-sec="([^"]+)">([\s\S]*?)(?=<\/section>)/g)) {
  for (const topic of section[2].matchAll(/<details class="topic"([^>]*)>/g)) {
    const attrs = topic[1];
    const title = decode(attrs.match(/data-track="([^"]+)"/)?.[1] || "");
    const aliases = decode(attrs.match(/data-progress-aliases="([^"]*)"/)?.[1] || "")
      .split("|").map((item) => item.trim()).filter(Boolean);
    toggles.push({ title, section: sectionNames.get(section[1]) || section[1], aliases });
  }
}

let state;
let applied;
if (process.argv[2] === "--apply") {
  const origin = (process.argv[3] || "").replace(/\/$/, "");
  if (!origin.startsWith("https://")) throw new Error("Usage: node tools/audit-progress.mjs --apply https://worker.example");
  const response = await fetch(`${origin}/api/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ toggles }),
  });
  if (!response.ok) throw new Error(`Sync failed: HTTP ${response.status} ${await response.text()}`);
  const data = await response.json();
  applied = { added: data.added, migrated: data.migrated };
  state = { items: data.items, lastCron: data.lastCron, updated: data.updated };
} else {
  const raw = await new Promise((resolve) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { value += chunk; });
    process.stdin.on("end", () => resolve(value));
  });
  state = JSON.parse(raw);
}

const beforeDue = Object.values(state.items || {}).filter((item) => item.due && !item.mergedInto).length;
const result = syncTrackedTopics(state, toggles, "2026-09-03");
const afterDue = computeActiveDue(state, "2026-09-03");
const visible = new Set(toggles.map((item) => item.title));
const activeOrphans = Object.entries(state.items || {})
  .filter(([title, item]) => !visible.has(title) && !item.mergedInto)
  .map(([title]) => title);

console.log(JSON.stringify({
  toggles: toggles.length,
  applied,
  beforeDue,
  afterDue,
  ...result,
  activeOrphans,
}, null, 2));
