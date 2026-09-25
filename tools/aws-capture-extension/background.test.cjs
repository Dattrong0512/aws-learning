const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

let listener;
let reloaded = 0;
let ready = false;
let onUpdated;
let receiverResult = { ok: true, count: 3 };
const chrome = {
  runtime: { onMessage: { addListener(fn) { listener = fn; } } },
  tabs: {
    async query() { return [{ id: 7 }]; },
    async sendMessage() {
      if (!ready) throw new Error("Could not establish connection. Receiving end does not exist.");
      return receiverResult;
    },
    async reload(tabId) { reloaded++; ready = true; onUpdated(tabId, { status: "complete" }); },
    async get() { return { status: "complete" }; },
    onUpdated: { addListener(fn) { onUpdated = fn; }, removeListener() {} }
  }
};

vm.runInNewContext(readFileSync(__dirname + "/background.js", "utf8"), {
  chrome,
  setTimeout(fn, ms) { if (ms < 10000) fn(); return 1; },
  clearTimeout() {}
});

const deliver = () => new Promise((resolve) => listener(
  { type: "aws-learning-deliver", dataUrl: "data:image/png;base64,test" },
  {},
  resolve
));

deliver().then(async (result) => {
  assert.equal(result.ok, true, result.error);
  assert.equal(result.count, 3);
  assert.equal(reloaded, 1);
  receiverResult = { ok: false, error: "Không lưu được ảnh" };
  const failed = await deliver();
  assert.equal(failed.ok, false);
  assert.equal(failed.error, "Không lưu được ảnh");
  assert.equal(reloaded, 1, "storage errors must not reload or retry the tab");
  console.log("AWS capture stale-tab recovery passed");
});
