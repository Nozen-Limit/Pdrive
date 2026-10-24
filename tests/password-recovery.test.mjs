import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";
import {
  recoveryRoute,
  recoveryCallback,
  createResetRequester,
} from "../src/lib/password-recovery.js";
test("Recovery routing handles PKCE markers, implicit callbacks and expired links", () => {
  assert.equal(
    recoveryCallback("http://127.0.0.1:4175/Pdrive/#bank=anything"),
    "http://127.0.0.1:4175/Pdrive/?recovery=1",
  );
  assert.equal(
    recoveryRoute("https://example.test/?recovery=1&code=mock").requested,
    true,
  );
  assert.equal(
    recoveryRoute("https://example.test/#type=recovery&access_token=mock")
      .requested,
    true,
  );
  assert.equal(
    recoveryRoute("https://example.test/?code=signup").requested,
    false,
  );
  assert.match(
    recoveryRoute(
      "https://example.test/#error=access_denied&error_code=otp_expired",
    ).error,
    /expired or is invalid/,
  );
});
test("Reset requests prevent double sends, persist cooldown and surface provider limits without pretending success", async () => {
  let now = 0,
    count = 0,
    resolve;
  const values = new Map(),
    store = {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    };
  const auth = {
    resetPasswordForEmail: async (email, args) => {
      count++;
      assert.equal(email, "teacher@example.test");
      assert.match(args.redirectTo, /recovery=1/);
      return new Promise((r) => (resolve = r));
    },
  };
  const request = createResetRequester(
    auth,
    "http://localhost/Pdrive/",
    store,
    () => now,
  );
  const pending = request(" Teacher@Example.test ");
  await assert.rejects(request("teacher@example.test"), /already being sent/);
  resolve({ data: {}, error: null });
  await pending;
  await assert.rejects(request("teacher@example.test"), /wait 60 seconds/);
  const another = createResetRequester(
    auth,
    "http://localhost/Pdrive/",
    store,
    () => now,
  );
  await assert.rejects(another("teacher@example.test"), /wait 60 seconds/);
  assert.equal(count, 1);
  now = 61000;
  const limited = createResetRequester(
    {
      resetPasswordForEmail: async () => ({
        error: { status: 429, code: "over_email_send_rate_limit" },
      }),
    },
    "http://localhost/Pdrive/",
    store,
    () => now,
  );
  await assert.rejects(
    limited("teacher@example.test"),
    (e) => e.status === 429 && /sending limit/.test(e.message),
  );
  await assert.rejects(limited("teacher@example.test"), /wait 60 seconds/);
  await assert.rejects(request("not-email"), /valid email/);
});
test("A delayed recovery event opens the change-password form and a late state response cannot replace it", async () => {
  const app = { innerHTML: "" },
    listeners = {};
  let recovering = false,
    resolveState;
  const c = vm.createContext({
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => null },
    document: {
      querySelector: (s) => (s === "#app" ? app : null),
      addEventListener() {},
    },
    addEventListener: (name, handler) => (listeners[name] = handler),
    window: {
      sikapBackend: {
        get recovery() {
          return recovering;
        },
        ready: async () => {},
        api: async () => new Promise((resolve) => (resolveState = resolve)),
      },
    },
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), c);
  const loading = vm.runInContext("load()", c);
  await new Promise((r) => setImmediate(r));
  recovering = true;
  listeners["sikap:password-recovery"]();
  assert.match(app.innerHTML, /Set a new password/);
  resolveState({
    user: { role: "teacher", approval_status: "approved" },
    modules: [],
    notes: [],
    teachers: [],
    events: [],
    notifications: [],
  });
  await loading;
  assert.match(app.innerHTML, /Set a new password/);
  assert.doesNotMatch(app.innerHTML, /Resource board/);
});
