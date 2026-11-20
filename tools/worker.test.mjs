import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

test("saved content is read-only, including stale clients and beacon requests", async () => {
  const saved = { version: "grouped-v2", sections: { iam: "saved lesson" } };
  let reads = 0;
  const env = { SR: { get: async key => { assert.equal(key, "content-v1"); reads++; return saved; },
    put: () => assert.fail("KV must never be written") } };
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await worker.fetch(new Request("https://example.com/api/content", { method }), env);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  }
  assert.equal(reads, 0);
  assert.deepEqual(await (await worker.fetch(new Request("https://example.com/api/content"), env)).json(), saved);
  assert.equal(await (await worker.fetch(new Request("https://example.com/api/content", { method: "HEAD" }), env)).text(), "");
});

test("retired routes cannot serve old assets", async () => {
  const env = { ASSETS: { fetch: () => assert.fail("retired routes must not reach assets") } };
  for (const path of ["/Exam", "/Exam/", "/Exam/notes", "/Exam/notes.html", "/Exam/index.html"]) {
    assert.equal((await worker.fetch(new Request("https://example.com" + path), env)).status, 410);
  }
  const redirect = await worker.fetch(new Request("https://example.com/all.html"), env);
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/");
});
