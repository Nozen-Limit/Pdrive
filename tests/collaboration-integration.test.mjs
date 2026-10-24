import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("Local collaboration preview mounts inside the existing workspace and is absent from hosted navigation", async () => {
  const source = await readFile("src/features/digital-bank/views.js", "utf8");
  let workspace, mounted;
  const context = vm.createContext({
    data: { user: { role: "teacher" } },
    bank: {
      screen: "collaboration",
      layout: "list",
      scope: "shared",
      filters: {},
    },
    location: { hostname: "127.0.0.1" },
    bankCategories: { METHODS: "Methods", MODELS: "Models", UNITS: "Units" },
    ico: (s) => s,
    esc: (s) => String(s),
    bankAppearanceMenu: () => "appearance-controls",
    workspaceRender: (options) => {
      workspace = options;
    },
    window: {
      sikapCollaboration: {
        mount: (role) => {
          mounted = role;
        },
      },
    },
  });
  vm.runInContext(source, context);
  assert.match(
    vm.runInContext("bankNavigation()", context),
    /Collaboration<\/span>/,
  );
  vm.runInContext("bankRender()", context);
  assert.match(workspace.content, /id="bank-collaboration-preview"/);
  assert.equal(workspace.bankPage, true);
  assert.match(workspace.navigation, /Personal Notes/);
  assert.match(workspace.actions, /appearance-controls/);
  assert.equal(mounted, "teacher");
  context.location.hostname = "nozen-limit.github.io";
  assert.doesNotMatch(
    vm.runInContext("bankNavigation()", context),
    /Collaboration<\/span>/,
  );
});
test("Approved collaboration rows use the normal Digital Bank table with credits and safe preview actions", async () => {
  const source = await readFile("src/features/digital-bank/views.js", "utf8");
  const context = vm.createContext({
    data: { user: { role: "teacher", id: "tom" } },
    bank: {
      scope: "shared",
      layout: "list",
      filters: {},
      result: { items: [], page: 1, total: 0 },
    },
    location: { hostname: "127.0.0.1" },
    ico: (s) => s,
    esc: (s) => String(s ?? ""),
    date: (s) => s,
    window: {
      sikapCollaboration: {
        published: () => [
          {
            id: "deck",
            title: "Shared slide deck",
            category: "UNITS",
            subject: "Science",
            grade: "Grade 7",
            term: "Quarter 2",
            version: 1,
            filename: "lesson.pptx",
            type: "pptx",
            credits: ["Tom", "Mara"],
            updated: "2026-10-24",
          },
        ],
      },
    },
  });
  const html = vm.runInContext(source + "\nbankResults()", context);
  assert.equal((html.match(/<table/g) || []).length, 1);
  assert.match(html, /Shared slide deck/);
  assert.match(html, /Contributors: Tom, Mara/);
  assert.match(html, /bankOpen\('collaboration:deck'\)/);
  assert.doesNotMatch(html, /bankDownload\('collaboration:deck'/);
  assert.doesNotMatch(html, /Collaboration resources/);
  assert.match(html, /1\u20131 of 1/);
});
