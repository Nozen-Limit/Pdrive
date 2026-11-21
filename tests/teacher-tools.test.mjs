import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "10000000-0000-4000-8000-000000000009",
  teacher = "10000000-0000-4000-8000-000000000001",
  colleague = "10000000-0000-4000-8000-000000000002",
  coordinator = "10000000-0000-4000-8000-000000000003",
  head = "10000000-0000-4000-8000-000000000004";
const PDF = "application/pdf";
const resource = {
  title: "Energy flow in rice fields",
  category: "UNITS",
  subject: "Science",
  grade: "Grade 8",
  term: "Term 2",
  description: "Local food chains",
  competency: "Explain energy flow in a local ecosystem",
  localization: "Uses rice fields near the school",
  tags: ["rice"],
};
const mid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let currentUser = null;
async function as(db, id) {
  currentUser = id;
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function receipt(db, who, module, name) {
  await db.exec("reset role");
  const key = `${who}/${module}/${name}`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('sikap-modules',$1,$2,$3)",
    [key, who, { size: 40, mimetype: PDF }],
  );
  await db.query(
    "insert into bank_uploads(key,owner,module,filename,mime,bytes,sha256) values($1,$2,$3,$4,$5,40,$6)",
    [key, who, module, name, PDF, "a".repeat(64)],
  );
  await as(db, who);
  return key;
}
async function submit(db, n, who = teacher) {
  await as(db, who);
  const key = await receipt(db, who, mid(n), `r${n}.pdf`);
  await db.query("select bank_save($1,$2,null,$3,true)", [
    mid(n),
    { ...resource, title: `${resource.title} ${n}` },
    key,
  ]);
}
// Read as the database owner, then return to the current user.
async function revision(db, n) {
  const who = currentUser;
  await db.exec("reset role");
  const value = (
    await db.query("select revision from modules where id=$1", [mid(n)])
  ).rows[0].revision;
  if (who) await as(db, who);
  return value;
}
const rejects = (promise, pattern) => assert.rejects(promise, pattern);

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const f of [
    "setup",
    "account-approval",
    "school-workflow",
    "digital-bank",
    "curriculum-catalog",
    "collaboration",
    "proposal-alignment",
    "teacher-tools",
    "teacher-tools",
  ])
    await db.exec(await readFile(`supabase/${f}.sql`, "utf8"));
  for (const [id, name] of [
    [owner, "Owner Head"],
    [teacher, "Ana Reyes"],
    [colleague, "Ben Cruz"],
    [coordinator, "Carla Lim"],
    [head, "Dina Santos"],
  ])
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
      [id, `${id}@example.test`, { name }],
    );
  await db.exec(`update profiles set approval_status='approved';
    update profiles set role='head',is_owner=true where id='${owner}';
    update profiles set role='head' where id='${head}';`);
  return db;
}

test("Teacher tools: review assignment, coordinators, reject, roles and deactivation", async () => {
  const db = await database();
  try {
    await submit(db, 1);
    await submit(db, 2);

    // Only the owner grants the head role; any head names coordinators.
    await as(db, head);
    await rejects(
      db.query("select set_account_role($1,'head',false)", [colleague]),
      /Only the school owner/,
    );
    await db.query("select set_account_role($1,'teacher',true)", [coordinator]);
    await rejects(
      db.query("select set_account_role($1,'teacher',false)", [head]),
      /cannot be changed/,
    );
    await as(db, owner);
    await db.query("select set_account_role($1,'head',false)", [colleague]);
    await db.query("select set_account_role($1,'teacher',false)", [colleague]);

    // A coordinator reviews only what is assigned to them.
    await as(db, coordinator);
    const checks = {
      objectives: "met",
      content: "met",
      activities: "met",
      assessment: "met",
    };
    await rejects(
      db.query("select bank_decide($1,$2,'approved','',$3)", [
        mid(1),
        await revision(db, 1),
        checks,
      ]),
      /different approved reviewer/,
    );
    await as(db, head);
    await rejects(
      db.query("select bank_assign($1,$2)", [mid(1), teacher]),
      /head teacher or subject coordinator/,
    );
    await db.query("select bank_assign($1,$2)", [mid(1), coordinator]);
    await as(db, coordinator);
    const assigned = (await db.query("select bank_assigned() a")).rows[0].a;
    assert.deepEqual(
      assigned.map((r) => r.id),
      [mid(1)],
    );
    const details = (await db.query("select bank_details($1) d", [mid(1)]))
      .rows[0].d;
    assert.equal(details.canReview, true);
    await db.query("select bank_decide($1,$2,'approved','',$3)", [
      mid(1),
      await revision(db, 1),
      checks,
    ]);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select status from modules where id=$1", [mid(1)]))
        .rows[0].status,
      "approved",
    );

    // Reject is final and needs a reason; the teacher is told why.
    await as(db, head);
    await rejects(
      db.query("select bank_reject($1,$2,'')", [mid(2), await revision(db, 2)]),
      /reason/,
    );
    await db.query("select bank_reject($1,$2,'Copied from a textbook')", [
      mid(2),
      await revision(db, 2),
    ]);
    await as(db, teacher);
    const mine = (await db.query('select bank_list(\'{"scope":"mine"}\') l'))
      .rows[0].l;
    assert.equal(mine.items.find((r) => r.id === mid(2)).state, "rejected");
    await rejects(
      db.query("select bank_revise($1,$2,'x','y')", [
        mid(2),
        await revision(db, 2),
      ]),
      /returned resource/,
    );

    // A deactivated teacher loses access; their approved resource stays.
    await as(db, head);
    await db.query("select set_account_active($1,false)", [teacher]);
    await as(db, teacher);
    await rejects(db.query("select bank_list('{}')"), /approval required/);
    await as(db, colleague);
    const bank = (await db.query("select bank_list('{}') l")).rows[0].l;
    assert.ok(bank.items.some((r) => r.id === mid(1)));
    await as(db, head);
    await db.query("select set_account_active($1,true)", [teacher]);
    await rejects(
      db.query("select set_account_active($1,false)", [owner]),
      /Only teacher accounts/,
    );
  } finally {
    await db.close();
  }
});

test("Teacher tools: reports, sharing, my archive, extra files, transfer, mentions, announcements, export", async () => {
  const db = await database();
  try {
    await submit(db, 1);
    await as(db, head);
    await db.query("select bank_decide($1,$2,'approved','',$3)", [
      mid(1),
      await revision(db, 1),
      {
        objectives: "met",
        content: "met",
        activities: "met",
        assessment: "met",
      },
    ]);

    // Report a problem once; a head resolves it and the reporter is told.
    await as(db, colleague);
    await rejects(
      db.query("select bank_report($1,'Not a reason','')", [mid(1)]),
      /listed reason/,
    );
    await db.query(
      "select bank_report($1,'Wrong or broken file','Blank page 3')",
      [mid(1)],
    );
    await rejects(
      db.query("select bank_report($1,'Other','again')", [mid(1)]),
      /already reported/,
    );
    await as(db, head);
    const reports = (await db.query("select report_list() r")).rows[0].r;
    assert.equal(reports[0].reporter, "Ben Cruz");
    await db.query("select report_resolve($1,'Replaced the file')", [
      reports[0].id,
    ]);
    await as(db, colleague);
    await rejects(db.query("select report_list()"), /Head Teacher access/);

    // Share an approved resource with a colleague.
    await db.query("select bank_share($1,$2,'For Grade 8')", [
      mid(1),
      coordinator,
    ]);
    await db.exec("reset role");
    const shared = (
      await db.query("select body from notifications where owner=$1", [
        coordinator,
      ])
    ).rows.map((r) => r.body);
    assert.ok(shared.some((b) => /Ben Cruz shared a resource/.test(b)));

    // My archive hides a resource from "mine" and shows it under "myarchive".
    await submit(db, 2);
    await as(db, teacher);
    await db.query("insert into hidden_resources(module) values($1)", [mid(1)]);
    const list = async (scope) =>
      (await db.query("select bank_list($1) l", [{ scope }])).rows[0].l;
    assert.deepEqual(
      (await list("mine")).items.map((r) => r.id),
      [mid(2)],
    );
    assert.deepEqual(
      (await list("myarchive")).items.map((r) => r.id),
      [mid(1)],
    );
    await as(db, colleague);
    await rejects(
      db.query("insert into hidden_resources(module) values($1)", [mid(2)]),
      /row-level security/,
    );

    // Extra files: only while editable, labelled, readable with the resource.
    await as(db, teacher);
    await db.query("select bank_save($1,$2,null,null,false)", [
      mid(3),
      resource,
    ]);
    const key = await receipt(db, teacher, mid(3), "answers.pdf");
    await db.query("select bank_attach($1,$2,'Answer key')", [mid(3), key]);
    const files = (await db.query("select bank_details($1) d", [mid(3)]))
      .rows[0].d.attachments;
    assert.equal(files[0].label, "Answer key");
    const key2 = await receipt(db, teacher, mid(3), "x.pdf");
    await rejects(
      db.query("select bank_attach($1,$2,'Photo')", [mid(3), key2]),
      /listed file label/,
    );
    await db.query("select bank_detach($1)", [files[0].id]);
    await rejects(
      db.query("select bank_attach($1,$2,'Worksheet')", [mid(1), key2]),
      /draft or returned/,
    );

    // Transfer ownership of a shared draft and @mention a member.
    await db.query("select collab_action($1,'invite',$2,$3)", [
      mid(3),
      { teacher: colleague },
      await revision(db, 3),
    ]);
    await as(db, colleague);
    await db.query("select collab_action($1,'respond',$2)", [
      mid(3),
      { status: "accepted" },
    ]);
    await db.query("select collab_action($1,'comment',$2,$3)", [
      mid(3),
      { body: "@Ana Reyes please check page 2" },
      await revision(db, 3),
    ]);
    await as(db, teacher);
    await rejects(
      db.query("select collab_transfer($1,$2,$3)", [
        mid(3),
        await revision(db, 3),
        coordinator,
      ]),
      /accepted the invitation/,
    );
    await db.query("select collab_transfer($1,$2,$3)", [
      mid(3),
      await revision(db, 3),
      colleague,
    ]);
    await db.exec("reset role");
    assert.equal(
      (await db.query("select owner from modules where id=$1", [mid(3)]))
        .rows[0].owner,
      colleague,
    );
    const mentions = (
      await db.query("select body from notifications where owner=$1", [teacher])
    ).rows.map((r) => r.body);
    assert.ok(mentions.some((b) => /Ben Cruz mentioned you/.test(b)));

    // Announcements: heads post, everyone reads, expired ones disappear.
    await as(db, teacher);
    await rejects(
      db.query("select announcement_post('Hi','x')"),
      /Only a head teacher/,
    );
    await as(db, head);
    await db.query(
      "select announcement_post('Term 2 deadline Friday','Submit by 5 pm',current_date+1)",
    );
    await rejects(
      db.query("select announcement_post('Old','x',current_date-1)"),
      /from today onward/,
    );
    await as(db, teacher);
    const news = (await db.query("select announcement_list() a")).rows[0].a;
    assert.equal(news[0].title, "Term 2 deadline Friday");

    // Export rows for head teachers only.
    await rejects(db.query("select report_rows()"), /Head Teacher access/);
    await as(db, head);
    const rows = (await db.query("select report_rows() r")).rows[0].r;
    assert.ok(rows.length >= 2 && rows.every((r) => r.teacher));
  } finally {
    await db.close();
  }
});
