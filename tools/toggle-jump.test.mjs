import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../src/client/navigation.mjs", import.meta.url), "utf8");
const t = (_, name) => `Về chủ đề: ${name}`;
const start = html.indexOf("function updateToggleJump(");
const end = html.indexOf('\nwindow.addEventListener("scroll",updateToggleJump', start);
assert.ok(start >= 0 && end > start);

test("returns to the current open topic and hides at its title, between topics, or at home", () => {
  const button = {};
  const visits = [];
  let reducedMotion = false;
  const topic = (title, summaryBottom, bottom) => {
    const summary = {
      getBoundingClientRect: () => ({ bottom: summaryBottom }),
      querySelector: () => ({ textContent: title }),
      scrollIntoView: options => visits.push({ title, options }),
      focus: options => assert.deepEqual(options, { preventScroll: true }),
    };
    return { querySelector: () => summary, getBoundingClientRect: () => ({ bottom }) };
  };
  let topics = [topic("Previous", -1000, -100), topic("Current", -100, 5000), topic("Next", 5100, 6000)];
  const document = {
    getElementById: () => button,
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 60 }) }),
    querySelectorAll: () => topics,
  };
  const update = Function("document", "matchMedia", "t", `${html.slice(start, end)}; return updateToggleJump;`)(document, () => ({ matches: reducedMotion }), t);

  update();
  assert.equal(button.hidden, false);
  assert.equal(button.title, "Về chủ đề: Current");
  button.onclick();
  assert.deepEqual(visits.pop(), { title: "Current", options: { behavior: "smooth", block: "start" } });
  reducedMotion = true;
  button.onclick();
  assert.equal(visits.pop().options.behavior, "auto");
  for (const visibleTopics of [[topic("At title", 100, 5000)], [topic("Previous", -1000, -100), topic("Next", 500, 2000)], []]) {
    topics = visibleTopics;
    update();
    assert.equal(button.hidden, true);
    assert.equal(button.onclick, null);
  }
});
