import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
const bundled = await build({
  entryPoints: ["src/backend.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  plugins: [
    {
      name: "mock-auth",
      setup(b) {
        b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
          path: "auth",
          namespace: "mock",
        }));
        b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents: "export const createClient = () => globalThis.mockClient;",
          loader: "js",
        }));
      },
    },
  ],
});
function backend(href, initializationError = null) {
  const callbacks = [],
    events = [],
    updates = [];
  let authEvent;
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    };
  const auth = {
    initialize: async () => ({ error: initializationError }),
    getSession: async () => ({
      data: { session: { user: { id: "mock-user" } } },
    }),
    onAuthStateChange: (fn) => (authEvent = fn),
    updateUser: async () => ({ data: { user: { id: "mock-user" } } }),
  };
  const chain = {
    update: (value) => {
      updates.push(value);
      return chain;
    },
    eq: () => chain,
    select: () => chain,
    single: async () => ({ data: { id: "mock-user" } }),
  };
  const c = vm.createContext({
    TransformStream,
    ReadableStream,
    WritableStream,
    Blob,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    console,
    exports: {},
    module: { exports: {} },
    mockClient: { auth, from: () => chain },
    window: {
      SIKAP_CONFIG: {
        supabaseUrl: "https://example.supabase.co",
        supabasePublishableKey: "public-test-key",
      },
      dispatchEvent: (e) => events.push(e.type),
    },
    location: new URL(href),
    localStorage: storage,
    sessionStorage: storage,
    setTimeout: (fn) => {
      callbacks.push(fn);
      return 1;
    },
    history: {
      replaceState(_state, _title, path) {
        c.location = new URL(path, c.location);
      },
    },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
  });
  vm.runInContext(bundled.outputFiles[0].text, c);
  return {
    api: c.window.sikapBackend,
    c,
    callbacks,
    events,
    updates,
    authEvent: (event) => authEvent(event),
  };
}
test("Recovery callback verification errors cannot reuse an unrelated signed-in session; clearing the invalid route restores ordinary sign-in", async () => {
  const { api, c } = backend(
    "http://localhost/Pdrive/?recovery=1&code=invalid",
    { message: "Invalid verifier" },
  );
  await assert.rejects(api.ready(), /cannot be verified/);
  api.clearRecovery();
  assert.equal(c.location.search, "");
  await api.ready();
  await assert.rejects(api.updatePassword("new-test-password"), /reset link/);
});
test("A valid recovery session accepts the password update; late recovery notifications mark the URL and notify the UI", async () => {
  const { api } = backend("http://localhost/Pdrive/?recovery=1&code=verified");
  await api.ready();
  await assert.rejects(api.updatePassword("short"), /12 characters/);
  await api.updatePassword("new-test-password");
  assert.equal(api.recovery, false);
  const late = backend("http://localhost/Pdrive/");
  late.authEvent("PASSWORD_RECOVERY");
  assert.equal(late.api.recovery, true);
  late.callbacks.forEach((fn) => fn());
  assert.equal(late.c.location.search, "?recovery=1");
  assert.deepEqual(late.events, ["sikap:password-recovery"]);
});
test("The profile API validates phone numbers before any database write", async () => {
  const { api, updates } = backend("http://localhost/Pdrive/");
  await assert.rejects(
    api.api("profile", { method: "PATCH", body: { phone: "12345" } }),
    /valid Philippine/,
  );
  assert.equal(updates.length, 0);
  await api.api("profile", {
    method: "PATCH",
    body: { phone: "0912 345 6789" },
  });
  assert.equal(updates[0].phone, "+639123456789");
});
