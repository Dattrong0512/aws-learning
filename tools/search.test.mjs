import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { translate } from "../src/client/i18n.mjs";
const t = (key,...args) => translate("vi",key,...args);

const html = ["search-core.mjs","search.mjs"].map(file => readFileSync(new URL("../src/client/"+file, import.meta.url), "utf8").replace(/^import .*;$/gm, "").replace(/^export .*;$/gm, "")).join("\n");
const start = html.indexOf("function normalizeSearch(");
const end = html.indexOf("function openSearch(", start);
assert.ok(start >= 0 && end > start);
const find = Function(`${html.slice(start, end)}; return findStudyMatches;`)();

test("searches content across pages with Vietnamese accents, case and whitespace ignored", () => {
  const sources = [
    { hash: "vpc", name: "VPC", blocks: [{ title: "NAT", text: "NAT Gateway cho private subnet" }] },
    { hash: "kms", name: "KMS", blocks: [{ title: "Encryption", text: "Mã hóa dữ liệu\nđồng thời dùng KMS." }] },
    { hash: "s3", name: "S3", blocks: [{ title: "Storage", text: "Mã hóa với SSE-KMS" }] },
  ];
  assert.deepEqual(find("  MA HOA  ", sources).map(m => m.hash), ["kms", "s3"]);
  assert.equal(find("du lieu dong thoi", sources)[0].title, "Encryption");
  assert.equal(find("PRIVATE SUBNET", sources)[0].page, "VPC");
  assert.deepEqual(find("", sources), []);
  assert.deepEqual(find("   ", sources), []);
  assert.deepEqual(find(".*", sources), []);
});

test("limits results to the current page and searches all pages from home", () => {
  const sources = [
    { hash: "vpc", name: "VPC", blocks: [{ title: "NAT", text: "NAT Gateway cho EC2" }] },
    { hash: "ec2", name: "EC2", blocks: [{ title: "Networking", text: "EC2 dùng NAT Gateway" }] },
  ];
  assert.deepEqual(find("NAT", sources, "vpc").map(m => m.hash), ["vpc"]);
  assert.deepEqual(find("NAT", sources, "ec2").map(m => m.hash), ["ec2"]);
  assert.deepEqual(find("NAT", sources, "").map(m => m.hash), ["vpc", "ec2"]);
  assert.deepEqual(find("", sources, "vpc"), []);
});

test("ranks exact service names, word boundaries, headings, and multi-token queries cleanly", () => {
  const sources = [
    { hash: "ec2", name: "EC2", blocks: [{ title: "Compute", text: "batch processing", element: "compute" }] },
    { hash: "s3", name: "S3", blocks: [{ title: "S3 Batch Operations", text: "Batch xử lý object", element: "s3" }] },
    { hash: "other", name: "Other Services", blocks: [{ title: "AWS Batch", element: "title", parts: [
      { text: "Batch job queue", element: "queue", context: "1. Queue" },
      { text: "Chạy batch job", element: "job", context: "2. Execution" },
    ] }] },
  ];
  const matches = find("batch", sources);
  assert.deepEqual(matches.map(match => match.title), ["AWS Batch", "S3 Batch Operations", "Compute"]);
  assert.equal(matches[0].count, 3);
  assert.equal(matches[0].element, "queue");
  assert.equal(matches[0].context, "1. Queue");
  assert.equal(matches[0].snippet, "Batch job queue");
  assert.equal(matches[0].items.length, 2, "collects structured sub-section items per topic");

  // Multi-token non-adjacent query + heading priority + word boundary check
  const multiSources = [
    { hash: "misc", name: "Misc", blocks: [{ title: "Diamond Catalog", text: "Parliament policy" }] },
    { hash: "iam", name: "IAM", blocks: [{ title: "Security Overview", parts: [
      { text: "3. IAM Database Authentication", element: "h3-iam", context: "3. IAM Database Authentication", isHeading: true },
      { text: "Token hiệu lực 15 phút cho RDS Aurora", element: "p-iam", context: "3. IAM Database Authentication" },
    ] }] },
  ];
  assert.equal(find("iam", multiSources)[0].hash, "iam", "word-boundary IAM beats mid-word diamond/parliament");
  const tokenRes = find("iam aurora token", multiSources);
  assert.equal(tokenRes.length, 1);
  assert.equal(tokenRes[0].hash, "iam");
});

test("maps accent-insensitive matches to original characters and keeps snippets near the keyword", () => {
  const { searchRanges, searchExcerpt } = Function(`${html.slice(start, end)}; return {searchRanges,searchExcerpt};`)();
  const text = "🪣 Ma\u0303\n  hóa, MÃ HÓA và mã hóa.";
  const ranges = searchRanges(text, "ma hoa");
  assert.deepEqual(ranges.map(([start, end]) => text.slice(start, end)), ["Ma\u0303\n  hóa", "MÃ HÓA", "mã hóa"]);
  assert.deepEqual(searchRanges("Batch BATCH batches", "batch"), [[0, 5], [6, 11], [12, 17]]);
  assert.deepEqual(searchRanges("Batch", ".*"), []);
  assert.deepEqual(searchRanges("Batch", ""), []);
  const excerpt = searchExcerpt("Không liên quan. ".repeat(40) + "Container xử lý Batch job rồi ghi kết quả về S3. " + "Đoạn khác. ".repeat(40), "batch");
  assert.ok(excerpt.startsWith("…") && excerpt.endsWith("…"));
  assert.ok(excerpt.includes("Batch job"));
  assert.ok(excerpt.length < 200);
});

test("renders structured topic cards with sub-section jump items while keeping global scope across navigation", () => {
  const node = tag => ({ tag, value: "", scrollTop: 0, children: [], attrs: {},
    appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
    setAttribute(name, value) { this.attrs[name] = value; } });
  const sections = [{ hash: "iam", name: "IAM" }, { hash: "ec2", name: "EC2" }];
  const sources = [
    { hash: "iam", name: "IAM", blocks: [
      { title: "Users", parts: [
        { text: "Users network rule", element: "u1", context: "1. Network" },
        { text: "Secondary network check", element: "u2", context: "2. Audit" },
      ] },
      { title: "Policies", text: "Policies network example", element: "p1" },
    ] },
    { hash: "ec2", name: "EC2", blocks: [{ title: "Launch", text: "Launch network example", element: "l1" }] },
  ];
  const nodes = Object.fromEntries(["searchInput", "searchPanel", "searchCount", "searchResults", "searchPage", "searchClear"].map(id => [id, node(id)]));
  nodes.searchInput.value = "network";
  const currentOption = {};
  nodes.searchPage.querySelector = () => currentOption;
  const document = { getElementById: id => nodes[id], querySelector: () => node("strong"), createElement: node, createTextNode: text => ({ textContent: text }) };
  const location = { hash: "#/iam" };
  const renderStart = html.indexOf("function renderSearch(");
  const renderEnd = html.indexOf("let searchTimer;", renderStart);
  const render = Function("document", "location", "SECTIONS", "getSources", "t", `${html.slice(start, end)}; getStudySearchSources=getSources; let searchTimer; ${html.slice(renderStart, renderEnd)}; return renderSearch;`)(document, location, sections, () => sources, t);
  render();
  const groups = nodes.searchResults.children;
  assert.deepEqual(groups.map(group => group.children[0].children[0].textContent), ["IAM", "EC2"]);
  assert.deepEqual(groups.map(group => group.children[1].children.length), [2, 1]);
  // First topic card in IAM has primary button + sublist for 2nd sub-section!
  assert.equal(groups[0].children[1].children[0].className, "search-topic-card");
  assert.equal(groups[0].children[1].children[0].children.length, 2, "primary result + sub-section list");
  assert.equal(nodes.searchCount.textContent, "3 kết quả · 2 chuyên đề");
  nodes.searchResults.scrollTop = 90;
  location.hash = "#/ec2";
  render();
  assert.equal(nodes.searchResults.children.length, 2);
  assert.equal(nodes.searchResults.scrollTop, 90);
  assert.equal(nodes.searchPage.value, "");
  nodes.searchPage.value = "current";
  render();
  assert.equal(nodes.searchResults.children[0].children[0].children[0].textContent, "EC2");
  assert.equal(nodes.searchCount.textContent, "1 kết quả · 1 chuyên đề");
  nodes.searchInput.value = "no match";
  render();
  assert.equal(nodes.searchResults.children[0].children[0].textContent, "Không tìm thấy kết quả cho ‘no match’");
  assert.equal(nodes.searchResults.children[0].children[1].textContent, "Xóa tìm kiếm");
  nodes.searchPage.value = "current";
  location.hash = "";
  render();
  assert.equal(nodes.searchPage.value, "");
  assert.equal(currentOption.disabled, true);
});

test("reveals the matching block and closed ancestors after navigation without closing search", () => {
  const outer = { open: false }, inner = { open: false, parentElement: { closest: () => outer } };
  const visits = [], animations = [];
  const target = { closest: () => inner, scrollIntoView: options => visits.push(options), getAnimations: () => [],
    animate: (frames, options) => animations.push(options) };
  const button = { _searchTarget: target, setAttribute: (name, value) => { button[name] = value; } };
  const panel = { hidden: false };
  const document = { querySelectorAll: selector => selector.includes("[aria-current]") ? [] : [button], getElementById: () => panel };
  const location = { hash: "#/ec2" };
  let pending;
  const window = { innerWidth: 390, addEventListener(event, listener, options) {
    assert.equal(event, "hashchange"); assert.deepEqual(options, { once: true }); pending = listener;
  } };
  const reveal = Function("document", "location", "window", `${html.slice(start, end)}; return revealSearchMatch;`)(document, location, window);
  reveal({ hash: "other", element: target });
  assert.equal(location.hash, "#/other");
  assert.equal(visits.length, 0, "must wait until the destination page is active");
  pending();
  assert.ok(inner.open && outer.open);
  assert.deepEqual(visits, [{ block: "start" }]);
  assert.equal(animations[0].duration, 1800);
  assert.equal(button["aria-current"], "location");
  assert.equal(panel.hidden, false);
  reveal({ hash: "other", element: target });
  assert.equal(visits.length, 2, "same-page clicks must reveal the block too");
});
