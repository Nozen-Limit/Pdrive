import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { validateResourceFile } from "../src/lib/resource-file.js";
import { docxFixture } from "./docx-fixture.mjs";
const user = "10000000-0000-4000-8000-000000000001",
  module = "20000000-0000-4000-8000-000000000001";
async function handler({
  approved = true,
  receiptFails = false,
  signedIn = true,
} = {}) {
  const stored = [],
    receipts = [],
    removed = [];
  let serve;
  const normal = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? { id: user } : null } }),
    },
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return {
            data: { approval_status: approved ? "approved" : "pending" },
          };
        },
        async maybeSingle() {
          return { data: null };
        },
      };
    },
    storage: {
      from() {
        return {
          async upload(key, bytes, options) {
            stored.push({ key, bytes, options });
            return {};
          },
        };
      },
    },
  };
  const admin = {
    from() {
      return {
        async insert(row) {
          receipts.push(row);
          return { error: receiptFails ? { message: "DB failed" } : null };
        },
      };
    },
    storage: {
      from() {
        return {
          async remove(keys) {
            removed.push(...keys);
            return {};
          },
        };
      },
    },
  };
  const source = (
    await readFile("supabase/functions/bank-upload/index.js", "utf8")
  ).replace(/^import .*;\r?\n/gm, "");
  vm.runInNewContext(source, {
    createClient: (_url, key) => (key === "service" ? admin : normal),
    validateResourceFile,
    Request,
    Response,
    Blob,
    File,
    JSON,
    Uint8Array,
    crypto: webcrypto,
    Deno: {
      env: {
        get: (name) =>
          name === "SUPABASE_SERVICE_ROLE_KEY" ? "service" : "public",
      },
      serve: (fn) => (serve = fn),
    },
  });
  return { serve, stored, receipts, removed };
}
function request(file, auth = true) {
  const body = new FormData();
  body.set("module", module);
  body.set("file", file);
  return new Request("https://example.test/functions/v1/bank-upload", {
    method: "POST",
    headers: auth ? { Authorization: "Bearer user-token" } : {},
    body,
  });
}
test("Upload service validates authentication, account approval and real file contents before issuing an immutable receipt", async () => {
  const h = await handler();
  assert.equal(
    (await h.serve(request(new File(["%PDF-"], "test.pdf"), false))).status,
    401,
  );
  assert.equal(
    (
      await (
        await handler({ approved: false })
      ).serve(request(new File(["%PDF-"], "test.pdf")))
    ).status,
    403,
  );
  assert.equal(
    (
      await h.serve(
        request(
          new File(["<script>bad</script>"], "test.pdf", {
            type: "application/pdf",
          }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (await h.serve(request(new File(["PKfake"], "test.docx")))).status,
    400,
  );
  assert.equal(h.stored.length, 0);
  const response = await h.serve(
    request(new File(["%PDF-1.4\n%%EOF"], "valid.pdf", { type: "text/plain" })),
  );
  assert.equal(response.status, 200);
  assert.ok(
    (await response.json()).object_key.startsWith(`${user}/${module}/`),
  );
  assert.equal(h.stored[0].options.contentType, "application/pdf");
  assert.equal(h.stored[0].options.upsert, false);
  assert.equal(h.receipts[0].owner, user);
  assert.equal(h.receipts[0].module, module);
  assert.equal(h.receipts[0].sha256.length, 64);
  const docx = await h.serve(
    request(new File([await docxFixture()], "valid.docx")),
  );
  assert.equal(docx.status, 200);
  const tooLarge = await h.serve(
    request(new File([new Uint8Array(20971521)], "big.pdf")),
  );
  assert.equal(tooLarge.status, 400);
  assert.equal(h.stored.length, 2);
});
test("Upload service removes its orphan file if verification cannot be recorded", async () => {
  const h = await handler({ receiptFails: true });
  const response = await h.serve(
    request(new File(["%PDF-1.4\n%%EOF"], "valid.pdf")),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(h.removed, [h.stored[0].key]);
});
