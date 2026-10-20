import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";
test("Digital Bank view switching preserves filters, themes and drafts while keeping Head-only actions out of Teacher navigation", async () => {
  const app = { innerHTML: "" },
    results = { innerHTML: "" };
  const store = {};
  const listeners = {};
  let requests = [];
  const state = {
    user: {
      id: "creator",
      name: "Creator",
      role: "teacher",
      approval_status: "approved",
    },
    modules: [],
    notes: [],
    teachers: [],
    notifications: [],
    events: [],
    workflowReady: true,
  };
  const item = {
    id: "20000000-0000-4000-8000-000000000001",
    title: "<script>Lesson</script>",
    creator: "Teacher",
    owner: "creator",
    category: "UNITS",
    subject: "Mathematics",
    grade: "Grade 7",
    term: "Quarter 2",
    state: "approved",
    type: "application/pdf",
    filename: "lesson.pdf",
    version: 1,
    updated: "2026-10-19",
    revision: 2,
  };
  const document = {
    querySelector: (selector) =>
      selector === "#app" ? app : selector === "#bank-results" ? results : null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      (listeners[type] ||= []).push(fn);
    },
  };
  const context = vm.createContext({
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console,
    innerWidth: 1200,
    document,
    localStorage: { getItem: () => null },
    sessionStorage: {
      getItem: (key) => store[key],
      setItem: (key, value) => (store[key] = value),
    },
    window: {
      scrollTo() {},
      sikapBackend: {
        bank: {
          list: async (filters, page) => {
            requests.push({ filters, page });
            return { items: [item], total: 1, page, pageSize: 25 };
          },
          facets: async () => ({
            subjects: ["Mathematics"],
            creators: ["Teacher"],
          }),
          stats: async () => ({ approved: 1 }),
        },
      },
    },
    addEventListener() {},
    state,
    item,
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), context);
  vm.runInContext(
    "data=state;view='bank';bank.filters={q:'fractions',grade:'Grade 7'};bank.result={items:[item],total:1,page:1};bankRender()",
    context,
  );
  assert.match(app.innerHTML, /Search in Digital Bank/);
  assert.doesNotMatch(
    app.innerHTML,
    /Resource Reviews|>Archived<|>All Resources</,
  );
  vm.runInContext("bankLayout('board')", context);
  assert.equal(vm.runInContext("bank.filters.grade", context), "Grade 7");
  assert.equal(vm.runInContext("bank.filters.q", context), "fractions");
  assert.equal(store["sikap-bank-layout"], "board");
  assert.match(results.innerHTML, /bank-board-card/);
  assert.match(results.innerHTML, /&lt;script&gt;Lesson/);
  assert.doesNotMatch(results.innerHTML, /<script>Lesson/);
  vm.runInContext("dirty=true;bankSetTheme('slate')", context);
  assert.equal(vm.runInContext("dirty", context), true);
  assert.equal(store["sikap-bank-theme"], "slate");
  await vm.runInContext("dirty=false;bankRead()", context);
  assert.equal(requests[0].filters.q, "fractions");
  assert.equal(requests[0].filters.grade, "Grade 7");
  for (const listener of listeners.change)
    listener({
      target: {
        closest: (selector) =>
          selector === ".bank-filter-popover"
            ? {}
            : selector.includes("form")
              ? {}
              : null,
      },
    });
  assert.equal(
    vm.runInContext("dirty", context),
    false,
    "filter controls do not mark resource drafts dirty",
  );
  vm.runInContext("data.user.role='head';bankRender()", context);
  assert.match(app.innerHTML, /Resource Reviews/);
  assert.match(app.innerHTML, />Archived</);
});
