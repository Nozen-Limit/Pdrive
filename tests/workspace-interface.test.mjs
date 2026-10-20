import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";

test("Both roles retain the same workspace brand, account, palette and dialog theme across every signed-in page", async () => {
  const app = { innerHTML: "" };
  const state = {
    user: {
      id: "user",
      name: "School User",
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
  const context = vm.createContext({
    console,
    URLSearchParams,
    queueMicrotask() {},
    localStorage: { getItem: () => null },
    document: {
      querySelector: (selector) => (selector === "#app" ? app : null),
      addEventListener() {},
    },
    window: {},
    addEventListener() {},
    state,
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), context);
  for (const role of ["teacher", "head"]) {
    state.user.role = role;
    vm.runInContext("data=state;bank.theme='slate'", context);
    const brand = vm.runInContext("workspaceBrand()", context);
    const account = vm.runInContext("workspaceAccount()", context);
    for (const page of [
      "dashboard",
      "requirements",
      "modules",
      "library",
      "starred",
      "reviews",
      "notes",
      "teachers",
      "notifications",
      "profile",
      ...(role === "teacher" ? ["submit"] : []),
      "bank",
    ]) {
      vm.runInContext(`view='${page}';render()`, context);
      assert.ok(app.innerHTML.includes(brand), `${role}/${page} brand`);
      assert.ok(app.innerHTML.includes(account), `${role}/${page} account`);
      assert.match(app.innerHTML, /app bank-app workspace-app/);
      assert.match(app.innerHTML, /name="bank-theme" value="slate" checked/);
      assert.doesNotMatch(
        app.innerHTML,
        /sidebar-resizer|class="profile-head"/,
      );
      const theme = vm.runInContext("bankThemeStyle()", context);
      assert.ok(
        app.innerHTML.includes(`class="workspace-dialogs" style="${theme}"`),
      );
      if (role === "head")
        assert.doesNotMatch(app.innerHTML, /onclick="go\('submit'\)"/);
    }
    for (const screen of ["upload", "detail"]) {
      vm.runInContext(
        `view='bank';bank.screen='${screen}';bank.loading=true;render()`,
        context,
      );
      assert.ok(app.innerHTML.includes(brand));
      assert.ok(app.innerHTML.includes(account));
    }
    vm.runInContext("bank.screen='list';bank.loading=false", context);
  }
});
