import { readUi } from "../scripts/ui-source.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
async function context() {
  const app = { innerHTML: "" },
    ctx = vm.createContext({
      console,
      URLSearchParams,
      localStorage: {
        getItem() {
          return null;
        },
      },
      document: {
        querySelector: (s) => (s === "#app" ? app : null),
        addEventListener() {},
      },
      addEventListener() {},
      window: { scrollTo() {} },
      confirm: () => false,
    });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), ctx);
  return ctx;
}
test("Unsaved changes block navigation until the user chooses to discard", async () => {
  const ctx = await context();
  ctx.calls = [];
  ctx.window.sikapBackend = {
    async api() {
      ctx.calls.push("state");
      return { user: { role: "teacher" } };
    },
  };
  vm.runInContext("dirty=true", ctx);
  await vm.runInContext("go('notes')", ctx);
  assert.equal(ctx.calls.length, 0);
  assert.equal(vm.runInContext("dirty", ctx), true);
  ctx.confirm = () => true;
  vm.runInContext("render=()=>{}", ctx);
  await vm.runInContext("go('notes')", ctx);
  assert.equal(ctx.calls.length, 1);
  assert.equal(vm.runInContext("view", ctx), "notes");
  assert.equal(vm.runInContext("dirty", ctx), false);
});
test("A successful save followed by failed refresh cannot be submitted twice", async () => {
  const ctx = await context(),
    error = { textContent: "" },
    button = { disabled: false, textContent: "Save" },
    form = {
      querySelector: (s) => (s === ".form-error" ? error : button),
      querySelectorAll: () => [button],
    };
  ctx.event = { preventDefault() {}, target: form };
  ctx.saved = 0;
  ctx.window.sikapBackend = {
    async api() {
      throw Error("Network unavailable");
    },
  };
  await vm.runInContext("formSave(event,async()=>{saved++})", ctx);
  assert.equal(ctx.saved, 1);
  assert.match(error.textContent, /Saved successfully/);
  assert.equal(button.disabled, true);
});
