import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { translate } from "../src/client/i18n.mjs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fill = (template, values) => template.replace(/\{\{([A-Za-z_]+)\}\}/g, (_, key) => {
  assert.ok(key in values, `Missing template value: ${key}`);
  return values[key];
});
const catalog = JSON.parse(read("content/catalog.json"));
assert.equal(catalog.length, 22, "The handbook must contain all 22 sections");

for (const lang of ["vi", "en"]) {
  const ui = JSON.parse(read(`src/templates/ui.${lang}.json`));
  const localized = catalog.map(section => ({ ...section, name: section.name[lang], desc: section.desc[lang], domainLabel: translate(lang, `domain_${section.domain}`) }));
  const sections = new Map(localized.map(section => {
    const content = read(`content/${lang}/${section.hash}.html`);
    assert.ok(content.trim(), `${lang}/${section.hash}: empty section`);
    assert.doesNotMatch(content, /<script\b|\bcontenteditable\s*=|\bon(?:click|error|load)\s*=/i, "Lessons must be static HTML");
    return [section.hash, fill(read("src/templates/section.html"), {
      ...Object.fromEntries(Object.entries(section).map(([key, value]) => [key, escape(value)])),
      allSections: escape(ui.allSections), expand: escape(ui.expand), CONTENT: content,
    })];
  }));
  const page = read("src/templates/page.html");
  const html = fill(page, {
    ...Object.fromEntries(Object.entries(ui).map(([key, value]) => [key, escape(value)])),
    LANG: lang, HOME_URL: lang === "vi" ? "/" : "/en/",
    CANONICAL: lang === "vi" ? "https://aws.trongle.tech/" : "https://aws.trongle.tech/en/",
    CATALOG: JSON.stringify(localized).replaceAll("<", "\\u003c"),
    SECTIONS: [...sections.values()].join("\n"),
  });
  assert.doesNotMatch(html, /\{\{(?:SECTION:)?[A-Za-z_]+\}\}/, "Unresolved template value");
  const output = lang === "vi" ? "public/" : "public/en/";
  mkdirSync(new URL(output, root), { recursive: true });
  writeFileSync(new URL(`${output}index.html`, root), html);
}
mkdirSync(new URL("public/assets/", root), { recursive: true });
for (const file of readdirSync(new URL("src/client/", root)).filter(file => file.endsWith(".mjs"))) {
  copyFileSync(new URL(`src/client/${file}`, root), new URL(`public/assets/${file}`, root));
}
copyFileSync(new URL("src/styles/site.css", root), new URL("public/assets/site.css", root));
// Retired output must not survive a rebuild or bypass the Worker via static assets.
const retired = fileURLToPath(new URL("public/Exam/", root));
assert.ok(retired.startsWith(fileURLToPath(new URL("public/", root))), "Retired assets must stay inside public/");
rmSync(retired, { recursive: true, force: true });
rmSync(fileURLToPath(new URL("public/all.html", root)), { force: true });
console.log("Built Vietnamese and English handbooks: 22 sections each.");
