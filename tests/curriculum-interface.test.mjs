import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(
  "src/features/digital-bank/curriculum.js",
  "utf8",
);
const sample = {
  id: "test-id",
  status: "verified",
  learning_area: "Science",
  grade: "Grade 7",
  quarter: "Quarter 1",
  competency_text: "TEST ONLY: canonical competency",
  official_code: null,
  source_title: "TEST source",
  source_url: "https://example.test/source.pdf",
  source_page: "1",
  curriculum_version: "TEST edition",
};
function context() {
  const controls = Object.fromEntries(
    [
      "#competency-select",
      "#competency-search",
      "#competency-options-state",
      "#competency-selected",
      "#competency-prev",
      "#competency-next",
    ].map((id) => [
      id,
      {
        innerHTML: "",
        textContent: "",
        value: "",
        isConnected: true,
        hidden: false,
      },
    ]),
  );
  const fields = { grade: "Grade 7", subject: "Science", term: "Quarter 1" };
  const requests = [];
  const c = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    fields,
    controls,
    requests,
    sample,
    data: { user: { id: "teacher", role: "teacher" } },
    dirty: false,
    esc: (value) =>
      String(value ?? "")
        .replaceAll("<", "&lt;")
        .replaceAll('"', "&quot;"),
    $: (id) => (id === ".bank-resource-form" ? {} : controls[id]),
    FormData: class {
      *[Symbol.iterator]() {
        yield* Object.entries(fields);
      }
    },
    bankApi: () => ({
      competencies: (filters) =>
        new Promise((resolve) => requests.push({ filters, resolve })),
    }),
    bankMessage: (error) => error.message,
  });
  vm.runInContext(source, c);
  return { c, controls, fields, requests };
}
test("The source-backed JHS choices cover all four grades and nine learning areas without inventing codes", async () => {
  const { c } = context();
  const names = vm.runInContext("curriculumAreaNames()", c);
  assert.equal(names.length, 9);
  assert.equal(new Set(names).size, 9);
  assert.deepEqual(Array.from(vm.runInContext("curriculumGrades", c)), [
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
  ]);
  const sql = await readFile("supabase/curriculum-catalog.sql", "utf8");
  for (const name of names) assert.ok(sql.includes("'" + name + "'"));
  const html = vm.runInContext("curriculumGuideTable()", c);
  assert.match(html, /deped\.gov\.ph\/revised-k-to-10-curriculum/);
  assert.doesNotMatch(html, /DEMO-/);
});
test("A delayed search response cannot replace options for a newly selected grade", async () => {
  const { c, fields, requests, controls } = context();
  const first = vm.runInContext("curriculumLoadOptions()", c);
  fields.grade = "Grade 8";
  const second = vm.runInContext("curriculumLoadOptions()", c);
  requests[1].resolve({
    items: [
      {
        ...sample,
        id: "grade8",
        grade: "Grade 8",
        competency_text: "Grade 8 result",
      },
    ],
    total: 1,
  });
  await second;
  assert.match(controls["#competency-select"].innerHTML, /Grade 8 result/);
  requests[0].resolve({ items: [sample], total: 1 });
  await first;
  assert.doesNotMatch(controls["#competency-select"].innerHTML, /test-id/);
  assert.match(controls["#competency-select"].innerHTML, /grade8/);
});
test("Form validation rejects empty, forged and mismatched choices and sends canonical text", () => {
  const { c } = context();
  assert.throws(
    () => vm.runInContext("curriculumValidateFields({...fields})", c),
    /verified/,
  );
  vm.runInContext("curriculum.selected=sample", c);
  assert.throws(
    () =>
      vm.runInContext(
        "curriculumValidateFields({...fields,competency_id:'forged'})",
        c,
      ),
    /verified/,
  );
  assert.throws(
    () =>
      vm.runInContext(
        "curriculumValidateFields({...fields,competency_id:sample.id,grade:'Grade 8'})",
        c,
      ),
    /verified/,
  );
  assert.throws(
    () =>
      vm.runInContext(
        "curriculumValidateFields({...fields,competency_id:sample.id,subject:'Unlisted'})",
        c,
      ),
    /listed/,
  );
  const sent = vm.runInContext(
    "const sent={...fields,competency_id:sample.id,competency:'forged text'};curriculumValidateFields(sent);sent",
    c,
  );
  assert.equal(sent.competency, sample.competency_text);
});
test("Account changes discard privileged catalog state and legacy resources require a reviewed mapping", async () => {
  const { c } = context();
  vm.runInContext(
    "curriculum.account='head';curriculum.result={items:[{status:'draft'}]};curriculum.selected=sample;curriculumResetAccount()",
    c,
  );
  assert.equal(vm.runInContext("curriculum.result", c), null);
  assert.equal(vm.runInContext("curriculum.selected", c), null);
  vm.runInContext(
    "bank={editing:{bank_competency_legacy:true,bank_competency:'Old text'}};bankCategories={METHODS:'Methods',MODELS:'Models',UNITS:'Units'};ico=()=>'';bankFileSummary=()=>''",
    c,
  );
  vm.runInContext(
    await readFile("src/features/digital-bank/forms.js", "utf8"),
    c,
  );
  const html = vm.runInContext("bankUploadForm()", c);
  assert.match(html, /select name="subject" required/);
  assert.match(html, /name="competency_id" required/);
  assert.doesNotMatch(html, /Legacy|head teacher maps|Curriculum catalog/);
  assert.match(html, /Contextualization \/ Localization/);
  assert.doesNotMatch(html, /textarea name="competency"/);
});
test("The empty-catalog rollout keeps uploads working as Legacy, while enforcement or verified entries disable that fallback", () => {
  const { c } = context();
  vm.runInContext("curriculum.config={verified_count:0,enforced:false}", c);
  assert.doesNotMatch(
    vm.runInContext("curriculumFields({})", c),
    /Legacy|catalog is not ready|head teacher maps/,
  );
  assert.throws(
    () =>
      vm.runInContext("curriculumValidateFields({...fields,competency:''})", c),
    /Enter/,
  );
  assert.doesNotThrow(() =>
    vm.runInContext(
      "curriculumValidateFields({...fields,competency:'Existing free text'})",
      c,
    ),
  );
  vm.runInContext("curriculum.config.enforced=true", c);
  assert.throws(
    () =>
      vm.runInContext(
        "curriculumValidateFields({...fields,competency:'Free text'})",
        c,
      ),
    /verified/,
  );
  vm.runInContext("curriculum.config={verified_count:1,enforced:false}", c);
  assert.throws(
    () =>
      vm.runInContext(
        "curriculumValidateFields({...fields,competency:'Free text'})",
        c,
      ),
    /verified/,
  );
});
