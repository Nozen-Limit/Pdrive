import { test } from "node:test";
import assert from "node:assert/strict";
import { attachProfilePhoto } from "../src/lib/profile-photo.js";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("Private photos resolve saved references and surface signing failures without retaining stale URLs", async () => {
  const person = { avatar_key: "teacher/photo.jpg", avatarUrl: "expired" };
  const storage = {
    from(bucket) {
      assert.equal(bucket, "sikap-avatars");
      return {
        createSignedUrl: async (key, ttl) => {
          assert.equal(key, person.avatar_key);
          assert.equal(ttl, 3600);
          return { data: { signedUrl: "https://example.test/private.jpg" } };
        },
      };
    },
  };
  await attachProfilePhoto(storage, person);
  assert.equal(person.avatarUrl, "https://example.test/private.jpg");
  await attachProfilePhoto(
    {
      from: () => ({
        createSignedUrl: async () => ({ error: { message: "Access denied" } }),
      }),
    },
    person,
  );
  assert.equal(person.avatarUrl, undefined);
  assert.match(person.avatarError, /saved.*Access denied/);
  delete person.avatar_key;
  await attachProfilePhoto(storage, person);
  assert.equal(person.avatarError, undefined);
});

test("A saved photo remains visible when the following profile refresh fails", async () => {
  const calls = [],
    messages = [];
  const saved = {
    avatar_key: "teacher/photo.jpg",
    avatarUrl: "https://example.test/private.jpg",
  };
  const ctx = vm.createContext({
    busy: false,
    dirty: false,
    view: "profile",
    data: { user: { id: "teacher", name: "Teacher" } },
    createImageBitmap: async () => ({ width: 20, height: 20, close() {} }),
    document: {
      addEventListener() {},
      createElement: () => ({
        getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob: (done) => done(new Blob(["image"], { type: "image/jpeg" })),
      }),
    },
    FormData,
    File,
    Blob,
    render() {},
    toast: (message) => messages.push(message),
    api: async (path) => {
      calls.push(path);
      if (path === "profile/photo") return saved;
      throw Error("Refresh unavailable");
    },
    event: {
      target: { files: [{ type: "image/jpeg", size: 40 }], value: "chosen" },
    },
  });
  vm.runInContext(
    await readFile(new URL("../src/ui/profile.js", import.meta.url), "utf8"),
    ctx,
  );
  await vm.runInContext("uploadProfilePhoto(event)", ctx);
  assert.equal(ctx.data.user.avatarUrl, saved.avatarUrl);
  assert.equal(ctx.busy, false);
  assert.deepEqual(calls, ["profile/photo", "state"]);
  assert.match(messages.at(-1), /Picture saved/);
});
