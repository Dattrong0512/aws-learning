import { join } from "node:path";

export function createStudyBatches(options) {
  const count = Math.ceil(options.files.length / 25);
  return Array.from({ length: count }, (_, i) => {
    const files = options.files.slice(i * 25, (i + 1) * 25);
    return { files, prompt: createStudyPrompt({ ...options, files, isNew: options.isNew && i === 0,
      batch: { number: i + 1, count, totalImages: options.files.length } }) };
  });
}

export function createStudyPrompt({ section, sectionHash, isNew, dir, files, note, batch }) {
  const imageList = files.map((file) => `  - ${join(dir, file)}`).join("\n");
  const targetInstruction = isNew
    ? `This is a NEW page named "${section}". Create content/vi/${sectionHash}.html and
content/en/${sectionHash}.html, then add the matching SECTIONS entry to content/catalog.json
(hash "${sectionHash}", el "sec-${sectionHash}"). Update expected section/topic counts
in the build validator. Start with the smallest sensible set of major topics.`
    : `This is the EXISTING page "${section}" (data-sec="${sectionHash}"). Read every
existing major topic on that page before editing. Prefer updating the matching major
service topic. Create a new toggle only for a genuinely distinct service/concept.`;
  const noteBlock = note
    ? `\nOPTIONAL USER GENERATION INSTRUCTION (never copy this text into the notes):\n"""\n${note}\n"""\nPrioritize this instruction when it does not conflict with correctness.\n`
    : "";
  const batchBlock = batch?.count > 1 ? `
BATCH ${batch.number}/${batch.count}: ${files.length} of ${batch.totalImages} total images.
Only read this batch's listed images; never reopen images from other batches.
Batch boundaries MUST NOT determine topic boundaries. All batches update ONE destination page.
${batch.number > 1 ? "Earlier batches are already integrated into the current HTML. Read the whole destination page and merge into the SAME existing major topics. Preserve earlier essential facts, useful tables, decision-relevant exact values, diagram relationships, exceptions and tracking IDs; deduplicate repeated explanations." : "Later batches will enrich these same major topics. Group by service/concept, not by this batch."}
${batch.number === batch.count ? "This is the FINAL batch. Audit the entire destination page, including earlier-batch content: consolidate repeated concepts across batches, keep essential technical details and useful comparisons, and verify access and encryption facts within all touched service topics." : "Keep this batch's important details in the HTML so later batches can merge them without rereading these images."}
` : "";

  return `You are generating and integrating AWS SAA-C03 study notes from lecture screenshots.

FIRST read ./CLAUDE.md and ./content/vi/${sectionHash}.html. Then read ALL images below together as
ONE conceptual input. Screenshot boundaries MUST NOT determine topic boundaries.

Images (${files.length}):
${imageList}

Target:
${targetInstruction}
${noteBlock}
${batchBlock}
YOUR JOB IS NOT TRANSCRIPTION.

Understand → reorganize → deduplicate → group related concepts → explain purpose →
explain important behavior → preserve technical facts → provide practical use cases →
integrate complete but reviewable notes.

GROUPING AND EXISTING-TOPIC MERGING:
- Do NOT create one topic per screenshot or one toggle per small feature.
- Several images about one AWS service normally update ONE existing major service toggle.
- Normalize service names when matching: for example "Amazon Simple Queue Service (SQS)"
  and "Amazon SQS" are the same service; "SNS Message Filtering" belongs inside "Amazon SNS".
- When updating an existing topic, keep its data-track unchanged so learned/review state,
  dates and counters remain attached. Preserve its data-progress-aliases attribute.
- If substantial existing information is useful, merge it; do not replace it blindly.
- A genuinely new major topic must use a unique data-track and data-progress-aliases="".
- Prefer roughly 3–6 major toggles per page; large pages such as S3 may use more.
- Internal features are headings, paragraphs, lists or tables inside the major toggle,
  not nested collapsible study topics.

MATCH THE CURRENT PAGE FORMAT EXACTLY:
- Before writing, inspect two or three neighboring topics in the destination section and
  imitate their markup, information density, terminology and level of detail. New imports
  must look like part of the current grouped-v2 notes, not a second presentation format.
- Each genuinely new major topic uses this exact outer shape (with suitable content):

  <details class="topic" data-track="Canonical major topic" data-progress-aliases="">
    <summary><span class="t-title">Canonical major topic</span></summary>
    <div class="body">
      <p><strong>Mục đích:</strong> ...</p>
      <hr>
      <h3>1. Core concept</h3>
      <p>Short explanation introducing the concept.</p>
      <pre><code class="language-text">Term
= short, clear definition</code></pre>
      <p>One important behavior or condition.</p>
      <pre><code class="language-text">Client
↓
Service
↓
Backend</code></pre>
      <hr>
      <h3>2. Use cases</h3>
      <p><strong>Use cases:</strong></p>
      <ul><li>Concrete architecture example.</li></ul>
    </div>
  </details>

- Match the compact block style of the Disaster Recovery and KMS pages and the user's API Gateway
  example: short explanations, multiline definitions/features, vertical flows and useful comparisons.
- Use consecutively numbered <h3> blocks separated by <hr>; use <h4> for real sub-concepts.
  A heading contains only its short label, never paragraphs, lists, tables, code or diagrams.
- Use <pre><code class="language-text"> for short definitions (Term, then = meaning), feature
  lists (one feature per line), vertical flows, commands/config or small trees. Put flow arrows
  on separate lines. Do not flatten blocks into A · B · C or put long paragraphs inside code.
- Keep caveats and prerequisites in short prose; introduce a block with a sentence when needed.
  Omit flows that merely repeat the definition.
- No required word count or overview bullet count. Do not expand topics already in this style.
  For formatting-only tasks, change only older prose-heavy content and leave already matching
  topics unchanged, including their saved bodies. New source facts may still enrich a matching topic.
  Do not leave a generic summary followed by a second version of the same explanation.
- Do not add topic-group wrappers, nested <details>, cards, callout systems, badges or a
  parallel summary/detail layout. Keep the current flat list of major topic toggles.
- Keep the summary title and data-track identical for a new topic. For an existing topic,
  preserve its current data-track, title and data-progress-aliases unless the user explicitly
  asks for a rename. Never reuse an alias as the data-track of another topic.

CONTENT STANDARD:
- Write explanations in Vietnamese; keep AWS service names and technical terms in English.
- Every major service/topic begins with <p><strong>Mục đích:</strong> ...</p> explaining
  what problem it solves in one or two concise sentences.
- Follow with clearly named <h3>/<h4> sections, paragraphs, bullets and focused tables covering
  how it works, architecture, important configuration, availability/scaling,
  security/networking, integrations and limitations where relevant.
- Every major service/topic includes <p><strong>Use cases:</strong></p> with concrete,
  architecture-oriented examples that answer when someone would choose it.
- Interpret useful data/control paths as concise flows, normally in <pre><code>.
- Preserve comparison/specification tables when they clarify an architecture choice; shorten
  repeated rows and irrelevant detail rather than turning a useful comparison into vague prose.
- Keep exact technical facts that affect the correct answer: prerequisites, supported modes,
  AZ/Region scope, retention, timeouts, sizes, throughput, IOPS, bandwidth, ports and exceptions.
  Explain what each number controls and verify or label version-sensitive values when needed.
- There is no hard word cap or minimum. Remove repetition, not useful facts; avoid lecture
  narration, exhaustive quota matrices, duplicate examples and irrelevant pricing detail.
- Preserve important facts from both screenshots and current notes. Never invent unreadable
  values; add only enough standard AWS context to make the material understandable.
- Inspect all source table/diagram annotations, then retain the distinctions necessary for
  SAA-C03. Do not copy every legible row merely to preserve slide length.

DO NOT ADD:
- Dấu hiệu đề thi, Keyword đề thi, Exam Tips, Mẹo nhớ, Thấy X chọn Y or filler conclusions.
- A hidden "full explanation" toggle, study-details wrapper or compact cheat-sheet layer.
- Duplicate explanations, repeated footer summaries (SAA-C03 Exam Focus, Nhớ nhanh, Câu nhớ tổng thể),
  or exhaustive quota matrices. Place any unique important footer fact in its matching block once.

DIAGRAMS AND MULTIPLE IMAGES:
- Interpret diagrams as architecture. Capture meaningful relationships and convert them
  into a concise flow or small HTML/SVG diagram; do not merely transcribe labels.
- Deduplicate concepts repeated across images before deciding the minimum topic set.
- Images covering SNS overview/filtering/FIFO/SNS+SQS should normally update one Amazon SNS topic.
- Images covering SQS and SNS should normally update two separate major service topics.

ACCESS AND ENCRYPTION WITHIN EACH TOPIC:
- For every AWS service added or materially updated, keep relevant security facts inside
  its existing topic. The separate access-reference page has been removed; do not recreate it.
- Distinguish control-plane IAM from data-plane access. Mention applicable resource policies,
  service/task roles, network controls or native credentials concisely.
- Explain the applicable at-rest mechanism/KMS relationship and in-transit protection such
  as TLS when useful. Include only mechanisms that actually apply; do not invent encryption.
- Merge these facts into the matching subsection instead of adding duplicate explanations.

SAFETY AND OUTPUT CONTRACT:
- Edit ONLY content/vi/${sectionHash}.html and its full English counterpart
  content/en/${sectionHash}.html. For a NEW page, also update content/catalog.json and
  the expected section/topic counts. Never edit generated public/ files.
- Preserve IDs, tracking aliases and all unrelated topics. Do not add decorative icons
  or trailing AWS source citation links.
- Do not edit src/worker.js or review/KV data. The website is read-only.
- Before finishing, run: node tools/build-site.mjs && node tools/validate-import.mjs
- If validation fails, fix the HTML before returning.
- Your final response must only summarize which major topics were added or updated.

Internally verify before finishing:
1. All images were interpreted together rather than independently.
2. Related material was merged into the smallest reasonable topic set.
3. Existing matching topics were updated rather than duplicated.
4. Mục đích and practical Use cases are present.
5. Essential existing facts, useful comparisons, decision-relevant exact values and tracking IDs remain intact.
6. Relevant access and encryption facts are accurate within each touched service topic.
7. The topic uses concise numbered blocks, heading-only labels and practical use cases without duplicate summaries.
8. HTML and data-track values validate successfully.`;
}
