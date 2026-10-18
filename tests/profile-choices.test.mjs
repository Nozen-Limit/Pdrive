import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

test("Teaching dropdowns retain multiple and existing custom selections without rerendering the form", async () => {
  const label = { textContent: "" };
  const dropdown = {
    querySelectorAll: (selector) =>
      selector === "input:checked"
        ? [{ value: "Mathematics" }, { value: "Robotics" }]
        : [],
    querySelector: () => label,
  };
  const ctx = vm.createContext({
    document: { addEventListener() {} },
    esc: (value) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;"),
    ico: () => "",
    input: { closest: () => dropdown },
    render: () => {
      throw Error("Should not rerender a profile draft");
    },
  });
  vm.runInContext(
    await readFile(new URL("../src/ui/profile.js", import.meta.url), "utf8"),
    ctx,
  );
  const html = vm.runInContext(
    'profileMultiSelect("subjects", "Subjects handled", ["Mathematics","Science"], ["Mathematics","Robotics"] )',
    ctx,
  );
  assert.match(html, /<details[^>]*class="profile-multiselect"/);
  assert.match(html, /name="subjects" value="Mathematics" checked/);
  assert.match(html, /name="subjects" value="Robotics" checked/);
  assert.doesNotMatch(html, /value="Science" checked/);
  vm.runInContext("updateProfileSelections(input)", ctx);
  assert.equal(label.textContent, "Mathematics, Robotics");
});
