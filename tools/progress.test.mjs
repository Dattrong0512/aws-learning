import assert from "node:assert/strict";
import test from "node:test";
import { computeActiveDue, syncTrackedTopics } from "../src/progress.mjs";

test("merges legacy progress into the canonical topic without postponing review", () => {
  const state = {
    items: {
      "SNS overview": { section: "Messaging", status: "✅ Thuộc", interval: 35, last: "2026-08-20", next: "2026-09-24", due: false },
      "SNS filtering": { section: "Messaging", status: "🔁 Ôn lại", interval: 7, last: "2026-08-20", next: "2026-08-27", due: true },
    },
  };

  const result = syncTrackedTopics(state, [{
    title: "Amazon SNS",
    section: "Messaging",
    aliases: ["SNS overview", "SNS filtering"],
  }], "2026-09-03");

  assert.deepEqual(result, { added: 0, migrated: 2 });
  assert.equal(state.items["Amazon SNS"].next, "2026-08-27");
  assert.equal(state.items["Amazon SNS"].interval, 7);
  assert.equal(state.items["SNS overview"].mergedInto, "Amazon SNS");
  assert.equal(state.items["SNS filtering"].mergedInto, "Amazon SNS");
  assert.equal(computeActiveDue(state, "2026-09-03"), 1);
  assert.equal(state.items["SNS filtering"].due, false);
  assert.equal(state.items["Amazon SNS"].due, true);
});

test("migration is idempotent and cannot regress a reviewed canonical topic", () => {
  const state = {
    items: {
      "Amazon SNS": { section: "Messaging", status: "✅ Thuộc", interval: 35, last: "2026-09-03", next: "2026-10-08", due: false },
      "SNS filtering": { section: "Messaging", status: "📖 Đang học", interval: 1, last: "2026-08-01", next: "2026-08-02", due: false, mergedInto: "Amazon SNS" },
    },
  };

  const result = syncTrackedTopics(state, [{ title: "Amazon SNS", section: "Messaging", aliases: ["SNS filtering"] }], "2026-09-03");
  assert.deepEqual(result, { added: 0, migrated: 0 });
  assert.equal(state.items["Amazon SNS"].interval, 35);
  assert.equal(state.items["Amazon SNS"].next, "2026-10-08");
});

test("adds a genuinely new topic at the first review interval", () => {
  const state = { items: {} };
  const result = syncTrackedTopics(state, [{ title: "Amazon Data Firehose", section: "Messaging", aliases: [] }], "2026-09-03");
  assert.deepEqual(result, { added: 1, migrated: 0 });
  assert.deepEqual(state.items["Amazon Data Firehose"], {
    section: "Messaging",
    status: "🆕 Mới",
    interval: 0,
    last: null,
    next: "2026-09-03",
    due: false,
  });
});

test("preserves a historical grouped topic reviewed after its earlier migration", () => {
  const state = {
    items: {
      "SNS overview": { section: "Messaging", status: "📖 Đang học", interval: 3, last: "2026-08-26", next: "2026-08-29", due: true },
      "SNS filtering": { section: "Messaging", status: "📖 Đang học", interval: 3, last: "2026-08-26", next: "2026-08-29", due: true },
      "Old Amazon SNS": {
        section: "Messaging", status: "🔁 Ôn lại", interval: 7, last: "2026-09-02", next: "2026-09-09", due: false,
        migratedFrom: ["SNS overview", "SNS filtering"], migratedAt: "2026-08-31T08:36:02.305Z",
      },
    },
  };

  const result = syncTrackedTopics(state, [{
    title: "Amazon SNS",
    section: "Messaging",
    aliases: ["SNS overview", "SNS filtering", "Old Amazon SNS"],
  }], "2026-09-03");

  assert.deepEqual(result, { added: 0, migrated: 3 });
  assert.equal(state.items["Amazon SNS"].next, "2026-09-09");
  assert.equal(state.items["Amazon SNS"].interval, 7);
  assert.equal(state.items["Old Amazon SNS"].mergedInto, "Amazon SNS");
  assert.equal(computeActiveDue(state, "2026-09-03"), 0);
});

test("does not let an unreviewed historical aggregate override its source records", () => {
  const state = {
    items: {
      "Amazon SQS": {
        section: "Messaging", status: "🔁 Ôn lại", interval: 16, last: "2026-08-26", next: "2026-09-11", due: false,
        migratedFrom: ["SQS visibility"], migratedAt: "2026-08-31T08:36:02.305Z",
      },
      "SQS visibility": { section: "Messaging", status: "📖 Đang học", interval: 3, last: "2026-08-26", next: "2026-08-29", due: true },
    },
  };

  syncTrackedTopics(state, [{ title: "Amazon SQS", section: "Messaging", aliases: ["SQS visibility"] }], "2026-09-03");
  assert.equal(state.items["Amazon SQS"].next, "2026-08-29");
  assert.equal(state.items["Amazon SQS"].interval, 3);
  assert.equal(computeActiveDue(state, "2026-09-03"), 1);
});
