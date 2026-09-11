import { join } from "node:path";

export function createStudyPrompt({ section, sectionHash, isNew, dir, files, note }) {
  const imageList = files.map((file) => `  - ${join(dir, file)}`).join("\n");
  const targetInstruction = isNew
    ? `This is a NEW page named "${section}". Add its navigation card, a section with
<section id="sec-${sectionHash}"> and <div class="content" data-sec="${sectionHash}">,
plus the matching SECTIONS entry. Start with the smallest sensible set of major topics.`
    : `This is the EXISTING page "${section}" (data-sec="${sectionHash}"). Read every
existing major topic on that page before editing. Prefer updating the matching major
service topic. Create a new toggle only for a genuinely distinct service/concept.`;
  const noteBlock = note
    ? `\nOPTIONAL USER GENERATION INSTRUCTION (never copy this text into the notes):\n"""\n${note}\n"""\nPrioritize this instruction when it does not conflict with correctness.\n`
    : "";

  return `You are generating and integrating AWS SAA-C03 study notes from lecture screenshots.

FIRST read ./CLAUDE.md and ./public/index.html. Then read ALL images below together as
ONE conceptual input. Screenshot boundaries MUST NOT determine topic boundaries.

Images (${files.length}):
${imageList}

Target:
${targetInstruction}
${noteBlock}
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
      <ul>
        <li>...</li>
      </ul>
      <p><strong>Use cases:</strong></p>
      <ul><li>...</li><li>...</li></ul>
      <p><strong>Luồng:</strong> A → B → C.</p>
    </div>
  </details>

- The Luồng paragraph is optional when no meaningful data/control path exists. Use as many
  <h3>/<h4> sections as needed to keep a grouped topic navigable. Tables, short paragraphs,
  <code>, <pre> or a small SVG may be inserted inside .body when useful.
- Follow the same reading rhythm as the richer existing topics: begin with Mục đích and a compact
  4–8 bullet overview, then use one descriptive <h3> for each substantial source concept. Use <h4>
  for mechanisms, constraints or sub-comparisons. End with practical Use cases; place Luồng near
  the overview or relevant subsection. This is a structure guide, not a reason to omit source facts.
- When enriching an existing short topic, integrate its useful summary into the detailed sections.
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
- Add a short <strong>Luồng:</strong> A → B → C only when data movement becomes clearer.
- Preserve comparison/specification tables already present in the notes or source. Do not turn
  a useful table into a vague bullet list. Prefer a table when three or more alternatives share
  comparable dimensions such as latency, durability, AZ scope, cost, throughput or limits.
- Never drop exact technical facts shown in the source: quotas, percentages, timeouts, retention,
  message/object sizes, throughput, IOPS, bandwidth, ports, supported families/modes, AZ/Region
  scope, prerequisites and exceptions. Label a value as source-specific when it may age.
- A grouped major topic will commonly need 450–1,200 words and may be longer when it consolidates
  many comparison-heavy slides. There is no hard word cap; remove repetition, not useful facts.
- Preserve important facts from both the screenshots and current notes. If text is unclear,
  do not invent exact values. Add only enough standard AWS context to make the source understandable.
- Treat every legible row, column, label, footnote, exception and numeric annotation in a source
  table or diagram as source content. Account for it explicitly in prose, a table or the interpreted
  flow; never keep only the headline while silently dropping the supporting technical details.

DO NOT ADD:
- Dấu hiệu đề thi, Keyword đề thi, Exam Tips, Mẹo nhớ, Thấy X chọn Y or filler conclusions.
- A hidden "full explanation" toggle, study-details wrapper or compact cheat-sheet layer.
- Duplicate explanations or exhaustive quota matrices unrelated to the supplied material. Exact
  technical values and comparison tables that appear in the source are not low-value and must stay.

DIAGRAMS AND MULTIPLE IMAGES:
- Interpret diagrams as architecture. Capture meaningful relationships and convert them
  into a concise flow or small HTML/SVG diagram; do not merely transcribe labels.
- Deduplicate concepts repeated across images before deciding the minimum topic set.
- Images covering SNS overview/filtering/FIFO/SNS+SQS should normally update one Amazon SNS topic.
- Images covering SQS and SNS should normally update two separate major service topics.

ACCESS & ENCRYPTION QUICK-REFERENCE IS MANDATORY:
- For every AWS service added or materially updated by this import, find the table under
  "Bảng tra nhanh — Access & Encryption" (data-sec="manageaccess") and add or update its
  matching row. Do this even when the screenshots do not explicitly discuss security.
- Follow the existing four columns exactly: Service | Access / Permission | Encryption |
  Giải thích & điểm cần nhớ. Keep one concise row per service or update the established
  combined family row when that is how the current table groups closely related services.
- Access / Permission must distinguish relevant control-plane IAM from data-plane access,
  and mention applicable resource policies, service/task roles, network controls or native
  credentials. Include only mechanisms that actually apply to that service.
- Encryption must state the applicable at-rest mechanism/KMS relationship and in-transit
  protection such as TLS. Use "—" when encryption is genuinely not applicable; do not invent it.
- The final column should explain the most useful permission/encryption distinction or
  cross-service gotcha in one or two compact sentences. Update an existing row instead of
  adding a duplicate, and do not rewrite unrelated rows or the surrounding table.

SAFETY AND OUTPUT CONTRACT:
- This integration uses a coding agent that edits public/index.html directly; there is no
  JSON response parser. Edit ONLY public/index.html and do not print JSON.
- Preserve navigation, import UI, JavaScript, IDs and all unrelated sections.
- Do not edit src/worker.js, tools/*.mjs or review/KV logic.
- Before finishing, run: node tools/validate-import.mjs
- If validation fails, fix the HTML before returning.
- Your final response must only summarize which major topics were added or updated.

Internally verify before finishing:
1. All images were interpreted together rather than independently.
2. Related material was merged into the smallest reasonable topic set.
3. Existing matching topics were updated rather than duplicated.
4. Mục đích and practical Use cases are present.
5. Important existing information, comparison tables, exact technical values and data-track IDs remain intact.
6. Every service touched has an accurate row in Bảng tra nhanh — Access & Encryption.
7. The topic follows overview → descriptive h3/h4 detail → practical use cases without duplicate summaries.
8. HTML and data-track values validate successfully.`;
}
