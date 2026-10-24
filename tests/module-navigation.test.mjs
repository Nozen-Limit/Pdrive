import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";

test("Digital Bank replaces duplicate module navigation for both roles", async () => {
  const app = { innerHTML: "" },
    children = { hidden: true },
    attributes = {};
  const state = {
    user: {
      id: "teacher",
      name: "Teacher",
      email: "teacher@example.test",
      role: "teacher",
      approval_status: "approved",
    },
    modules: [],
    notes: [],
    teachers: [],
    events: [],
    notifications: [],
    workflowReady: false,
  };
  const ctx = vm.createContext({
    console,
    URLSearchParams,
    innerWidth: 1280,
    localStorage: { getItem: () => null },
    document: {
      querySelector: (selector) =>
        selector === "#app"
          ? app
          : selector === "#module-subnav"
            ? children
            : null,
      addEventListener() {},
    },
    window: { scrollTo() {}, sikapBackend: { api: async () => state } },
    addEventListener() {},
    state,
    button: { setAttribute: (key, value) => (attributes[key] = value) },
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), ctx);
  vm.runInContext("data=state;render()", ctx);
  const initialPage = app.innerHTML;
  vm.runInContext("toggleModuleSections(button)", ctx);
  assert.equal(children.hidden, false);
  assert.equal(attributes["aria-expanded"], "true");
  assert.equal(
    app.innerHTML,
    initialPage,
    "expansion does not rerender or clear a draft",
  );
  await vm.runInContext("go('library')", ctx);
  assert.equal(vm.runInContext("view", ctx), "library");
  for (const role of ["teacher", "head"]) {
    state.user.role = role;
    vm.runInContext("render()", ctx);
    const nav = app.innerHTML.split('<nav class="nav">')[1].split("</nav>")[0];
    assert.doesNotMatch(nav, /go\('reports'\)/);
    assert.doesNotMatch(
      nav,
      /Requirements|Submit Module|My Modules|All Modules|module-subnav/,
    );
    assert.match(nav, /Digital Bank/);
    assert.doesNotMatch(
      vm.runInContext("overviewNew()", ctx),
      /go\('submit'\)/,
    );
    assert.doesNotMatch(
      vm.runInContext("bankNavigation()", ctx),
      /Requirements|My Modules|All Modules/,
    );
    if (role === "head")
      assert.ok(
        nav.indexOf("go('teachers')") < nav.indexOf("go('notifications')"),
      );
  }
  await vm.runInContext("go('reports')", ctx);
  assert.equal(vm.runInContext("view", ctx), "dashboard");
});
