import { readUi } from "../scripts/ui-source.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("Navigation refreshes state; notifications stay unread until acknowledged; failed refresh preserves the page", async () => {
  const app = { innerHTML: "" },
    toast = { textContent: "", classList: { add() {}, remove() {} } };
  const state = {
    user: {
      id: "teacher",
      role: "teacher",
      name: "Teacher",
      approval_status: "approved",
    },
    modules: [],
    notes: [],
    teachers: [],
    events: [],
    notifications: [
      { id: "notice", module: "lesson", body: "Review completed", read: false },
    ],
  };
  const calls = [];
  let failed = false;
  const ctx = vm.createContext({
    console,
    URLSearchParams,
    FormData,
    Blob,
    URL,
    setTimeout,
    location: { search: "" },
    localStorage: {
      getItem() {
        return null;
      },
    },
    document: {
      querySelector: (s) =>
        s === "#app" ? app : s === "#toast" ? toast : null,
      addEventListener() {},
    },
    addEventListener() {},
    window: {
      scrollTo() {},
      sikapBackend: {
        async ready() {},
        async api(path) {
          calls.push(path);
          if (path === "state") {
            if (failed) throw Error("Offline");
            return state;
          }
          if (path === "notifications")
            state.notifications.forEach((n) => (n.read = true));
          return {};
        },
      },
    },
  });
  vm.runInContext(await readUi(), ctx);
  await new Promise((r) => setTimeout(r, 10));
  calls.length = 0;
  await vm.runInContext("go('notifications')", ctx);
  assert.deepEqual(calls, ["state"]);
  assert.match(app.innerHTML, /Unread/);
  assert.match(app.innerHTML, /Mark all as read/);
  await vm.runInContext("markNotificationsRead()", ctx);
  assert.equal(state.notifications[0].read, true);
  assert.doesNotMatch(app.innerHTML, /<strong>Unread<\/strong>/);
  const before = app.innerHTML;
  failed = true;
  await vm.runInContext("go('notes')", ctx);
  assert.equal(app.innerHTML, before);
  assert.match(toast.textContent, /Could not refresh/);
});

test("Requirement screens distinguish missing, returned and late submissions without leaking HTML", async () => {
  const app = { innerHTML: "" },
    ctx = vm.createContext({
      console,
      URLSearchParams,
      Intl,
      localStorage: {
        getItem() {
          return null;
        },
      },
      document: {
        querySelector: (s) => (s === "#app" ? app : null),
        addEventListener() {},
      },
      addEventListener() {},
      window: {},
    });
  vm.runInContext((await readUi()).replace(/^load\(\);\s*$/m, ""), ctx);
  vm.runInContext(
    "data={workflowReady:true,user:{role:'head'},requirements:[{id:'r1',title:'<script>Lesson</script>',subject:'Science',grade:'Grade 5',term:'Quarter 1',year:'2026',due_at:'2026-01-01T10:00:00Z',cancelled:false},{id:'r2',title:'Cancelled',cancelled:true}],assignments:[{requirement_id:'r1',teacher:'A',teacher_id:'a',status:'missing',overdue:true,late:false},{requirement_id:'r1',teacher:'B',teacher_id:'b',module_id:'m2',status:'returned',overdue:true,late:true},{requirement_id:'r2',teacher:'C',status:'missing',overdue:false}],requirementEvents:[],reviews:[]};",
    ctx,
  );
  const html = vm.runInContext("requirementsPage()", ctx);
  assert.match(html, /Not submitted/);
  assert.match(html, /Needs revision/);
  assert.match(html, /Submitted late/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  vm.runInContext(
    "data.reviews=[{module:'m2',version:1,decision:'returned',reviewerName:'Head',created:'2026-01-01',checklist:{objectives:'met',content:'met',activities:'met',assessment:'revise'},feedback:'Add answer key'}]",
    ctx,
  );
  assert.match(vm.runInContext("reviewHistory('m2')", ctx), /Add answer key/);
  assert.match(
    vm.runInContext("reviewHistory('m2')", ctx),
    /Assessment and answer key/,
  );
});

test("Published dashboard renders an existing module from the single UI asset", async () => {
  const app = { innerHTML: "" };
  const ctx = vm.createContext({
    console,
    URLSearchParams,
    Intl,
    localStorage: {
      getItem() {
        return null;
      },
    },
    document: {
      querySelector: (s) => (s === "#app" ? app : null),
      addEventListener() {},
    },
    addEventListener() {},
    window: {},
  });
  const built = await readFile("docs/frontend.js", "utf8");
  vm.runInContext(built.replace(/^load\(\);\s*$/m, ""), ctx);
  vm.runInContext(
    "data={user:{id:'t',role:'teacher',name:'Teacher',approval_status:'approved'},workflowReady:true,modules:[{id:'m',title:'Existing module',teacher:'Teacher',subject:'Science',grade:'Grade 5',term:'Quarter 1',year:'2026',status:'pending',version:1,created:'2026-10-17',updated:'2026-10-17',deadline:'2026-10-20'}],notes:[],teachers:[],notifications:[],events:[],requirements:[],assignments:[]};render()",
    ctx,
  );
  assert.match(app.innerHTML, /Existing module/);
  assert.match(app.innerHTML, /overview-app/);
  assert.match(app.innerHTML, /Module board/);
  assert.doesNotMatch(app.innerHTML, /workspace-hero|real-desk-art/);
  assert.match(app.innerHTML, /Due/);
  assert.equal(vm.runInContext("typeof workflowModuleDue", ctx), "function");
  const profile = vm.runInContext("profilePage()", ctx);
  assert.doesNotMatch(profile, /Google|Link Google/);
  assert.match(profile, /Choose profile picture/);
  vm.runInContext(
    "data.user.avatarUrl='https://example.test/avatar.jpg';render()",
    ctx,
  );
  assert.match(app.innerHTML, /profile picture/);
  vm.runInContext("data.user.role='head';render()", ctx);
  assert.match(app.innerHTML, /Upload resource/);
  assert.doesNotMatch(app.innerHTML, /onclick="go\('submit'\)"/);
  vm.runInContext("overviewLayout='list';render()", ctx);
  assert.match(app.innerHTML, /Existing module/);
  assert.match(app.innerHTML, /module-row/);
  const html = await readFile("docs/index.html", "utf8");
  assert.doesNotMatch(html, /src="school-workflow\.js/);
});
