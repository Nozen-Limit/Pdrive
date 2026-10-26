import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const require = createRequire(import.meta.url);
async function load(path) {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    external: [
      "react",
      "react-dom",
      "@mui/material",
      "@emotion/react",
      "@emotion/styled",
    ],
    jsx: "automatic",
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    require,
    module,
    module.exports,
  );
  return module.exports;
}
const domain = await load("app/domain.ts");
const ui = await load("app/ui.tsx");
const resource = (id, state, owner = "teacher") => ({
  id,
  owner,
  title: "A saved resource",
  creator: "Teacher",
  subject: "Science",
  grade: "Grade 7",
  term: "Quarter 1",
  category: "METHODS",
  state,
  status: state,
  bank_draft: state === "draft",
  archived: state === "archived",
  version: 1,
  revision: 1,
  updated: "2026-10-26",
});
test("React monitoring counts each submitted resource once and folds resubmissions into pending", () => {
  const report = domain.summary(
    [
      resource("a", "approved"),
      resource("b", "pending"),
      resource("c", "resubmitted"),
      resource("d", "returned"),
      resource("e", "draft"),
      resource("f", "archived"),
    ],
    [
      {
        id: "teacher",
        name: "Teacher",
        role: "teacher",
        approval_status: "approved",
      },
      {
        id: "zero",
        name: "No submissions",
        role: "teacher",
        approval_status: "approved",
      },
    ],
  );
  assert.deepEqual(
    report.teachers.find((t) => t.id === "teacher"),
    {
      id: "teacher",
      name: "Teacher",
      submitted: 4,
      approved: 1,
      pending: 2,
      returned: 1,
    },
  );
  assert.equal(report.teachers.find((t) => t.id === "zero").submitted, 0);
  assert.equal(report.areas.find(([name]) => name === "Science")[1], 1);
  assert.equal(report.areas.length, 9);
});
test("React metadata validation rejects forged category, area, grade, quarter and missing competency or tags", () => {
  const valid = {
    category: "METHODS",
    subject: "Science",
    grade: "Grade 7",
    term: "Quarter 1",
    competency: "TEST fixture",
    tags: ["fixture"],
  };
  assert.doesNotThrow(() => domain.checkMetadata(valid));
  for (const patch of [
    { category: "FAKE" },
    { subject: "Made up" },
    { grade: "Grade 11" },
    { term: "Semester 1" },
    { competency: " " },
    { tags: [] },
  ])
    assert.throws(() => domain.checkMetadata({ ...valid, ...patch }));
});
test("React status prioritizes archive/draft flags and preserves revision state", () => {
  assert.equal(
    domain.resourceState({ ...resource("a", "approved"), archived: true }),
    "archived",
  );
  assert.equal(
    domain.resourceState({ ...resource("a", "pending"), bank_draft: true }),
    "draft",
  );
  assert.equal(
    domain.resourceState({
      ...resource("a", "pending"),
      state: undefined,
      version: 2,
    }),
    "resubmitted",
  );
});
test("React resource cards escape uploaded text and use the saved resource identity", () => {
  const html = renderToStaticMarkup(
    createElement(ui.ResourceCard, {
      resource: {
        ...resource("school-id", "approved"),
        title: "<script>unsafe</script>",
      },
      onOpen: () => {},
    }),
  );
  assert.ok(html.includes("&lt;script&gt;unsafe&lt;/script&gt;"));
  assert.ok(!html.includes("<script>unsafe"));
  assert.ok(html.includes("Approved"));
  assert.ok(!/Preview as|Feature preview|sample-account/.test(html));
});
test("Production uses the Vite React entry and never loads the old template renderer or demo page", async () => {
  const html = await readFile("docs/index.html", "utf8");
  assert.match(html, /type="module"/);
  assert.match(html, /react-assets\//);
  assert.doesNotMatch(
    html,
    /frontend\.js|backend\.js|workspace-ui\.css|collaboration-preview/,
  );
  const manifest = JSON.parse(
    await readFile("docs/.vite/manifest.json", "utf8"),
  );
  assert.equal(manifest["index.html"].isEntry, true);
});
