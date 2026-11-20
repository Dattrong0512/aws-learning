import assert from "node:assert/strict";
import test from "node:test";

test("real search module imports all helpers and renders an English query", async () => {
  const element = () => ({ value: "", children: [], addEventListener() {},
    setAttribute() {}, appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; }, querySelector() { return {}; } });
  const nodes = Object.fromEntries(["catalog","searchInput","searchPanel","searchPage","searchResults","searchCount","searchClear"].map(id => [id,element()]));
  nodes.catalog.textContent = "[]";
  nodes.searchInput.value = "KMS";
  const previousDocument = globalThis.document, previousLocation = globalThis.location;
  try {
    globalThis.document = { documentElement: { lang: "en" }, addEventListener() {},
      getElementById: id => nodes[id], querySelector: element, createElement: element };
    globalThis.location = { hash: "" };
    const { renderSearch } = await import("../src/client/search.mjs");
    renderSearch();
    assert.equal(nodes.searchCount.textContent,"0 results · 0 sections");
    assert.equal(nodes.searchResults.children[0].children[0].textContent,"No results for ‘KMS’");
  } finally {
    globalThis.document = previousDocument;
    globalThis.location = previousLocation;
  }
});
