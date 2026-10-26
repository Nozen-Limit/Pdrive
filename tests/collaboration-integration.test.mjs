import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, access } from "node:fs/promises";

const source = await readFile("src/features/digital-bank/views.js", "utf8");
function context(role = "teacher") {
  return vm.createContext({
    data: { user: { role, id: "school-user" } },
    bank: {
      screen: "list",
      scope: "shared",
      layout: "list",
      filters: {},
      result: { items: [], total: 0, page: 1, pageSize: 25 },
    },
    bankCategories: { METHODS: "Methods", MODELS: "Models", UNITS: "Units" },
    ico: (value) => value,
    esc: (value) => String(value ?? ""),
    date: (value) => value,
    bankState: (row) => row.state,
    location: { hostname: "nozen-limit.github.io" },
    // A stale demo global must not be able to inject rows into the school bank.
    window: {
      sikapCollaboration: {
        published: () => {
          throw Error("Demo data accessed");
        },
      },
    },
  });
}

test("School navigation has no demo account switcher or Collaboration preview for either role", () => {
  for (const role of ["teacher", "head"]) {
    const c = context(role);
    vm.runInContext(source, c);
    const navigation = vm.runInContext("bankNavigation()", c);
    assert.match(navigation, /Digital Bank/);
    assert.doesNotMatch(navigation, /Collaboration|Preview as|Feature preview/);
    assert.doesNotMatch(
      source,
      /sikapCollaboration|bankLoadCollaboration|bankPaintCollaboration/,
    );
  }
});

test("Digital Bank displays only saved school resources even when an old demo global exists", () => {
  const c = context();
  vm.runInContext(source, c);
  const empty = vm.runInContext("bankResults()", c);
  assert.match(empty, /No resources found/);
  assert.doesNotMatch(empty, /sample|preview|Shared slide deck/);
  vm.runInContext(
    `bank.result={items:[{
    id:"saved-resource", title:"Saved school resource", category:"METHODS",
    subject:"Science", grade:"Grade 7", term:"Quarter 1", creator:"School teacher",
    owner:"school-user", state:"approved", filename:"lesson.pdf", updated:"2026-10-25"
  }], total:1, page:1, pageSize:25}`,
    c,
  );
  const html = vm.runInContext("bankResults()", c);
  assert.match(html, /Saved school resource/);
  assert.match(html, /bankDownload/);
  assert.doesNotMatch(html, /collaboration:|Feature preview|sample-/);
});

test("The production build does not ship demo pages, account selectors, or sample assets", async () => {
  const build = await readFile("scripts/build.mjs", "utf8");
  assert.doesNotMatch(build, /await import\("\.\/build-collaboration-preview/);
  const index = await readFile("docs/index.html", "utf8");
  assert.doesNotMatch(index, /collaboration-embedded|collaboration-preview/);
  for (const path of [
    "docs/collaboration-preview.html",
    "docs/collaboration-preview.js",
    "docs/collaboration-preview.css",
    "docs/collaboration-embedded.css",
    "docs/mock-assets/water-cycle.pdf",
    "docs/mock-assets/water-cycle.pptx",
  ]) {
    await assert.rejects(access(path), { code: "ENOENT" });
  }
});
