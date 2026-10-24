import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";
async function context(list, role = "head") {
  const app = { innerHTML: "" };
  const state = {
    user: {
      id: "teacher-a",
      name: "Teacher A",
      role,
      approval_status: "approved",
    },
    modules: [{ id: "old", title: "Legacy workspace module" }],
    notes: [],
    teachers: [
      {
        id: "teacher-a",
        name: "Teacher A",
        role: "teacher",
        approval_status: "approved",
      },
      {
        id: "teacher-b",
        name: "Teacher B",
        role: "teacher",
        approval_status: "approved",
      },
      {
        id: "teacher-zero",
        name: "No submissions",
        role: "teacher",
        approval_status: "approved",
      },
    ],
    notifications: [],
    events: [],
  };
  const c = vm.createContext({
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    state,
    localStorage: { getItem: () => null },
    document: {
      querySelector: (s) => (s === "#app" ? app : null),
      addEventListener() {},
    },
    window: { sikapBackend: { bank: { list } }, scrollTo() {} },
    addEventListener() {},
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), c);
  vm.runInContext("data=state;view='dashboard'", c);
  return { c, app };
}
const row = (n, state = "approved") => ({
  id: "bank-" + n,
  title: "Resource " + n,
  owner: n % 2 ? "teacher-a" : "teacher-b",
  creator: n % 2 ? "Teacher A" : "Teacher B",
  category: "UNITS",
  subject: n % 2 ? "Science" : "Mathematics",
  grade: "Grade 7",
  term: "Quarter 1",
  state,
  version: 1,
  updated: "2026-10-23",
  created: "2026-10-20",
});
test("Overview fetches all bank pages, excludes drafts/archives, folds resubmissions into pending, and summaries ignore board filters", async () => {
  const rows = Array.from({ length: 27 }, (_, n) =>
    row(n, ["approved", "pending", "returned", "resubmitted"][n % 4]),
  );
  rows.push(
    { ...row(28, "draft"), bank_draft: true },
    { ...row(29, "archived"), archived: true },
  );
  const calls = [];
  const { c, app } = await context(async (filters, page) => {
    calls.push({ filters, page });
    return {
      items: rows.slice((page - 1) * 25, page * 25),
      total: rows.length,
      page,
      pageSize: 25,
    };
  });
  await vm.runInContext("overviewRead()", c);
  assert.deepEqual(
    calls.map((r) => r.page),
    [1, 2],
  );
  assert.ok(calls.every((r) => r.filters.scope === "all"));
  assert.equal(vm.runInContext("overview.items.length", c), 27);
  assert.match(app.innerHTML, /Resource board/);
  assert.doesNotMatch(app.innerHTML, /Legacy workspace module/);
  vm.runInContext(
    "filters.status='approved';filters.search='no match';overviewSummaryPage()",
    c,
  );
  assert.match(app.innerHTML, /Resources per teacher/);
  assert.match(app.innerHTML, /Approved resources per learning area/);
  const report = JSON.parse(
    vm.runInContext("JSON.stringify(overviewSummaryData())", c),
  );
  assert.equal(
    report.teachers.reduce((sum, t) => sum + t.submitted, 0),
    27,
  );
  assert.equal(
    report.teachers.reduce((sum, t) => sum + t.pending, 0),
    13,
  );
  assert.equal(
    report.teachers.reduce((sum, t) => sum + t.approved, 0),
    7,
  );
  assert.equal(
    report.teachers.reduce((sum, t) => sum + t.returned, 0),
    7,
  );
  assert.equal(
    report.teachers.find((t) => t.id === "teacher-zero").submitted,
    0,
  );
  assert.deepEqual(report.areas, [
    ["Mathematics", 7],
    ["Science", 0],
  ]);
  vm.runInContext(
    "overviewStatus('pending');filters.search='';overviewLayout='list';render()",
    c,
  );
  assert.match(app.innerHTML, /module-row/);
  assert.match(app.innerHTML, /overviewOpen\('bank-/);
  assert.doesNotMatch(app.innerHTML, /openModule\('bank-/);
});
test("Teachers request their own bank resources and cannot see the school summary; a failed later page never produces partial totals", async () => {
  let scope = "";
  const { c, app } = await context(async (filters) => {
    scope = filters.scope;
    return { items: [row(1, "returned")], total: 1 };
  }, "teacher");
  await vm.runInContext("overviewRead()", c);
  assert.equal(scope, "mine");
  assert.doesNotMatch(app.innerHTML, /View teacher summary|>Summary</);
  vm.runInContext("overviewSummaryPage()", c);
  assert.equal(vm.runInContext("overview.screen", c), "resources");
  let request = 0;
  c.window.sikapBackend.bank.list = async () => {
    if (++request === 1) return { items: [row(1)], total: 2 };
    throw Error("Resource request failed");
  };
  await vm.runInContext("overviewRead()", c);
  assert.equal(vm.runInContext("overview.ready", c), false);
  assert.equal(vm.runInContext("overview.items.length", c), 0);
  assert.match(app.innerHTML, /Try again/);
  assert.doesNotMatch(app.innerHTML, /<strong>1<\/strong>Submitted/);
});
