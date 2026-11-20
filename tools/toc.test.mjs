import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../src/client/navigation.mjs", import.meta.url), "utf8");
const source = html.slice(html.indexOf("function setTocOpen("), html.indexOf("function updateToggleJump("));

test("opens Other Services and returns removed or unknown routes to home", () => {
  const SECTIONS = JSON.parse(readFileSync(new URL("../content/catalog.json",import.meta.url),"utf8"));
  assert.ok(SECTIONS.some(section => section.hash === "otherservices"));
  assert.ok(!SECTIONS.some(section => section.hash === "manageaccess"));
  const elements = Object.fromEntries(["home", "tocBtn", "searchPanel", ...SECTIONS.map(section => section.el)].map(id =>
    [id, { hidden: true, classList: { toggle(name, active) { this[name] = active; } } }]));
  const location = { hash: "#/otherservices" };
  let renders = 0;
  const routeSource = html.slice(html.indexOf("function route(){"), html.indexOf('window.addEventListener("hashchange",route)'));
  const route = Function("location", "document", "SECTIONS", "window", "renderStudyToc", "setTocOpen", "updateToggleJump", "renderSearch",
    `${routeSource};return route;`)(location, { getElementById: id => elements[id] }, SECTIONS,
    { scrollTo() {}, innerWidth: 1200 }, () => renders++, () => {}, () => {}, () => {});
  route();
  assert.equal(elements["sec-otherservices"].classList.active, true);
  assert.equal(elements.home.classList.active, false);
  for (const hash of ["#/manageaccess", "#/unknown-page"]) {
    location.hash = hash;
    route();
    assert.equal(location.hash, "");
    assert.equal(renders, 1, "invalid routes must defer rendering until hashchange");
  }
  route();
  assert.equal(elements.home.classList.active, true);
  assert.equal(elements["sec-otherservices"].classList.active, false);
});

test("builds topic groups from live headings and reveals closed ancestors without changing routes", () => {
  const element = (tag, text = "") => ({
    tagName: tag.toUpperCase(), textContent: text, children: [], attrs: {},
    querySelector() { return null; },
    closest() { return null; },
    getClientRects() { return [{}]; },
    getBoundingClientRect() { return { top: this.top ?? 100 }; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    focus() { this.focused = true; },
  });
  const topic = (title, parent = null) => {
    const node = element("details");
    node.open = false;
    node.parentElement = { closest: () => parent };
    node.closest = () => node;
    const summary = element("summary");
    summary.querySelector = () => ({ textContent: title });
    summary.click = () => { node.open = true; };
    summary.closest = () => node;
    node.querySelector = () => summary;
    return node;
  };
  const first = topic("Disaster Recovery");
  const nested = topic("Nested mechanism", first);
  const second = topic("DRS");
  const heading = (tag, title, parent) => {
    const node = element(tag, title);
    node.parentElement = { closest: () => parent };
    node.closest = () => parent;
    node.scrollIntoView = options => { node.visited = options; };
    return node;
  };
  const rpo = heading("h1", "1. RPO vs RTO", first);
  const contentWrapper = heading("h3", "Có 2 lớp: Service Auto Scaling = tăng / giảm số Task", first);
  contentWrapper.querySelector = () => ({ tagName: "P" });
  const child = heading("h4", "Nested constraint", nested);
  let active = true, reducedMotion = false;
  const section = {
    querySelector: () => ({ textContent: "Disaster Recovery & Migrations" }),
    querySelectorAll: selector => {
      for (let level = 1; level <= 6; level++) assert.ok(selector.includes(`h${level}`));
      return [first, rpo, contentWrapper, nested, child, second];
    },
  };
  const ids = Object.fromEntries(["tocEntries", "tocBtn", "tocPanel", "tocPage"].map(id => [id, element("div")]));
  const selected = new Set();
  let links = [];
  const document = {
    createElement: element,
    addEventListener() {},
    getElementById: id => ids[id],
    querySelector: selector => selector === ".section.active" ? (active ? section : null) : { getBoundingClientRect: () => ({ bottom: 60 }) },
    querySelectorAll: selector => selector === "#tocEntries .toc-link" ? links : [...selected],
    body: { classList: { toggle(name, open) { this[name] = open; } } },
  };
  const window = { innerWidth: 1200, addEventListener() {} };
  const { renderStudyToc, revealTocTarget, updateTocActive } = Function("document", "window", "matchMedia", "ResizeObserver",
    `${source}; return {renderStudyToc,revealTocTarget,updateTocActive};`)(document, window, () => ({ matches: reducedMotion }), class { observe() {} });

  renderStudyToc();
  const groups = ids.tocEntries.children;
  assert.equal(groups.length, 2);
  assert.equal(ids.tocPage.textContent, "Disaster Recovery & Migrations");
  const children = groups[0].children[1].children;
  assert.equal(children.length, 2, "a heading wrapping paragraphs/code must not become an index entry");
  assert.equal(children[0].textContent, "1. RPO vs RTO");
  const childButton = children[1].children[1].children[0];
  assert.equal(childButton.className, "toc-link toc-sub");
  selected.add(children[0]);
  children[0].setAttribute("aria-current", "location");
  childButton.onclick();
  assert.equal(first.open, true);
  assert.equal(nested.open, true);
  assert.equal(childButton.attrs["aria-current"], "location");
  assert.equal(children[0].attrs["aria-current"], undefined);
  assert.deepEqual(child.visited, { behavior: "smooth", block: "start" });
  links = [children[0], childButton];
  rpo.top = -100;
  child.top = 70;
  updateTocActive();
  assert.equal(childButton.attrs["aria-current"], "location");
  child.top = 500;
  updateTocActive();
  assert.equal(children[0].attrs["aria-current"], "location", "scrolling back must update the index marker");
  assert.equal(childButton.attrs["aria-current"], undefined);
  const topicButton = groups[0].children[0].children[0];
  links.unshift(topicButton);
  child.top = 70;
  childButton.closest = () => ({ open: false, querySelector: () => topicButton, parentElement: { closest: () => null } });
  updateTocActive();
  assert.equal(topicButton.attrs["aria-current"], "location", "a collapsed index group must show the marker on its title");
  childButton.closest = () => null;

  window.innerWidth = 390;
  reducedMotion = true;
  revealTocTarget(rpo, children[0]);
  assert.equal(ids.tocPanel.hidden, true);
  assert.equal(ids.tocBtn.focused, true);
  assert.equal(rpo.visited.behavior, "auto");
  rpo.textContent = "Renamed heading";
  renderStudyToc();
  assert.equal(ids.tocEntries.children[0].children[1].children[0].textContent, "Renamed heading");
  active = false;
  renderStudyToc();
  assert.equal(ids.tocBtn.hidden, true);
  assert.equal(ids.tocEntries.children.length, 0);
});
