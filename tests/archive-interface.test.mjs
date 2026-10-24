import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readUi } from "../scripts/ui-source.mjs";
test("Archive/restore refreshes the originating screen, sends the revision, and preserves Head-only restore controls", async () => {
  const calls = [],
    app = { innerHTML: "" };
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
    window: {
      sikapBackend: { bank: { archive: async (args) => calls.push(args) } },
    },
    addEventListener() {},
  });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), c);
  vm.runInContext(
    `data={user:{id:'head',role:'head'}};toast=()=>{};bankDialog=async(_title,_body,action)=>action();overviewRead=async()=>{refreshes.push('overview')};bankRead=async()=>{refreshes.push('bank')};bankOpen=async()=>{refreshes.push('detail')}`,
    Object.assign(c, { refreshes: [] }),
  );
  await vm.runInContext(
    "view='dashboard';bank.screen='detail';bankArchive('resource',4,true)",
    c,
  );
  await vm.runInContext(
    "view='bank';bank.screen='list';bankArchive('resource',5,false)",
    c,
  );
  await vm.runInContext(
    "bank.screen='detail';bankArchive('resource',6,false)",
    c,
  );
  assert.deepEqual(c.refreshes, ["overview", "bank", "detail"]);
  assert.deepEqual(
    calls.map((x) => ({
      id: x.mid,
      revision: x.expected_revision,
      archive: x.archive,
    })),
    [
      { id: "resource", revision: 4, archive: true },
      { id: "resource", revision: 5, archive: false },
      { id: "resource", revision: 6, archive: false },
    ],
  );
  c.resource = {
    id: "resource",
    title: "Archived lesson",
    owner: "teacher",
    archived: true,
    status: "approved",
    revision: 5,
  };
  assert.match(
    vm.runInContext("bankActions(resource)", c),
    /bankArchive\('resource',5,false\)/,
  );
  vm.runInContext("data.user.role='teacher'", c);
  assert.doesNotMatch(
    vm.runInContext("bankActions(resource)", c),
    /bankArchive\(/,
  );
});
