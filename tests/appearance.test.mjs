import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("Appearance restores a saved choice, persists valid changes and ignores invalid palettes", async () => {
  const saved = new Map([["sikap-appearance", "ocean"]]);
  const variables = new Map(),
    events = [];
  const inputs = ["slate", "ocean", "forest", "warm"].map((value) => ({
    value,
    checked: false,
  }));
  const context = vm.createContext({
    localStorage: {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
    },
    document: {
      documentElement: {
        style: { setProperty: (key, value) => variables.set(key, value) },
      },
      querySelectorAll: () => inputs,
    },
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  });
  vm.runInContext(
    await readFile(new URL("../src/ui/appearance.js", import.meta.url), "utf8"),
    context,
  );
  assert.equal(inputs.find((input) => input.checked).value, "ocean");
  vm.runInContext("setAppearance('warm')", context);
  assert.equal(saved.get("sikap-appearance"), "warm");
  assert.equal(inputs.find((input) => input.checked).value, "warm");
  assert.equal(variables.get("--sikap-bg"), "#211c17");
  assert.equal(events.at(-1).type, "sikap-appearance");
  vm.runInContext("setAppearance('untrusted-color')", context);
  assert.equal(saved.get("sikap-appearance"), "warm");
  assert.match(
    vm.runInContext("appearanceControls(true)", context),
    /type="radio"/,
  );
});
