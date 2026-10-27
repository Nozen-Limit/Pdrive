import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
test("Original login keeps its original styles, font and particle-book document isolated from workspace styles", async () => {
  for (const name of [
    "styles.css",
    "book-landing.css",
    "workspace.css",
    "appearance.css",
    "digital-bank.css",
    "workspace-ui.css",
  ])
    assert.equal(
      await readFile(`docs/original-login/${name}`, "utf8"),
      await readFile(`src/${name}`, "utf8"),
    );
  const html = await readFile("docs/original-login/index.html", "utf8");
  assert.match(html, /Material\+Symbols/);
  assert.match(html, /landing-scene\.js/);
  assert.match(html, /auth\.js/);
  assert.doesNotMatch(html, /frontend\.js|backend\.js|head-desk\.js/);
});
test("Original login signs in through the existing backend and hands off to the workspace without forwarding credentials", async () => {
  const app = { innerHTML: "" },
    button = { disabled: false, textContent: "Sign in" },
    error = { textContent: "" },
    calls = [],
    messages = [];
  const backend = {
    recovery: false,
    recoveryError: "",
    api: async (path, options) => {
      calls.push({ path, options });
      return {};
    },
  };
  const window = {
    parent: {
      sikapBackend: backend,
      postMessage: (data, origin) => messages.push({ data, origin }),
    },
  };
  const context = vm.createContext({
    window,
    location: { origin: "https://school.example.test" },
    localStorage: { getItem: () => null },
    document: {
      querySelector: () => app,
      documentElement: {},
      querySelectorAll: () => [],
    },
    addEventListener: () => {},
    setTimeout: () => {},
    FormData: class {
      get(key) {
        return (
          { email: "teacher@example.test", password: "fixture-only" }[key] ??
          null
        );
      }
      has() {
        return false;
      }
    },
  });
  vm.runInContext(
    await readFile("docs/original-login/auth.js", "utf8"),
    context,
  );
  assert.match(app.innerHTML, /book-landing/);
  assert.match(app.innerHTML, /book-dust/);
  assert.match(app.innerHTML, /book-right/);
  assert.match(app.innerHTML, /schoolLogin\(event\)/);
  await window.schoolLogin({
    preventDefault() {},
    target: {
      querySelector(selector) {
        return selector.includes("submit") ? button : error;
      },
    },
  });
  assert.equal(calls[0].path, "auth/login");
  assert.equal(JSON.parse(calls[0].options.body).email, "teacher@example.test");
  assert.equal(button.disabled, false);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].origin, "https://school.example.test");
  assert.equal(messages[0].data.type, "sikap:authenticated");
  assert.equal(messages[0].data.recovered, false);
  assert.deepEqual(Object.keys(messages[0].data).sort(), ["recovered", "type"]);
});
