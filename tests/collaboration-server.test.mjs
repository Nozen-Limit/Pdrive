import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "10000000-0000-4000-8000-000000000001",
  member = "10000000-0000-4000-8000-000000000002",
  stranger = "10000000-0000-4000-8000-000000000003",
  head = "10000000-0000-4000-8000-000000000004",
  mid = "20000000-0000-4000-8000-000000000001";
const d = {
  title: "Joint resource",
  category: "METHODS",
  subject: "Science",
  grade: "Grade 7",
  term: "Quarter 1",
  description: "Original resource",
  competency: "Observe local examples",
  localization: "School garden",
  tags: ["garden"],
};
async function as(db, id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function action(db, kind, payload = {}) {
  const revision = (await db.query("select collab_state($1) as d", [mid]))
    .rows[0].d.resource.revision;
  return db.query("select collab_action($1,$2,$3,$4)", [
    mid,
    kind,
    payload,
    revision,
  ]);
}
async function receipt(db, id, serial) {
  await db.exec("reset role");
  const staging = `30000000-0000-4000-8000-${String(serial).padStart(12, "0")}`,
    key = `${id}/${staging}/proposal.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('sikap-modules',$1,$2,$3)",
    [key, id, { size: 40, mimetype: "application/pdf" }],
  );
  await db.query(
    "insert into bank_uploads(key,owner,module,filename,mime,bytes,sha256) values($1,$2,$3,'proposal.pdf','application/pdf',40,$4)",
    [key, id, staging, "a".repeat(64)],
  );
  await as(db, id);
  return {
    upload_module: staging,
    object_key: key,
    changes: "Proposed local examples",
  };
}
test("Real collaboration: invitation privacy, owner selection, frozen review, credits in bank, and approval of subsequent revisions", async () => {
  const db = new PGlite();
  try {
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
      "collaboration",
    ])
      await db.exec(await readFile(`supabase/${f}.sql`, "utf8"));
    for (const [id, name] of [
      [owner, "Owner"],
      [member, "Contributor"],
      [stranger, "Other"],
      [head, "Reviewer"],
    ])
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
        [id, `${name}@example.test`, { name }],
      );
    await db.exec(
      `update profiles set approval_status='approved';update profiles set role='head' where id='${head}';`,
    );
    await as(db, owner);
    await db.query("select bank_save($1,$2,null,null,false)", [mid, d]);
    await action(db, "invite", { teacher: member });
    await as(db, stranger);
    await assert.rejects(
      db.query("select collab_state($1)", [mid]),
      /access denied/,
    );
    await assert.rejects(
      db.query("select * from collab_members"),
      /permission denied/,
    );
    await as(db, member);
    let list = (await db.query("select collab_state() as d")).rows[0].d;
    assert.equal(list.resources[0].membership, "invited");
    await assert.rejects(
      db.query("select collab_state($1)", [mid]),
      /access denied/,
    );
    await db.query("select collab_action($1,'respond',$2,null)", [
      mid,
      { status: "accepted" },
    ]);
    await action(db, "comment", { body: "Use local garden examples" });
    const upload = await receipt(db, member, 1);
    await action(db, "propose", upload);
    await assert.rejects(action(db, "propose", upload), /Upload the file/);
    let detail = (await db.query("select collab_state($1) as d", [mid])).rows[0]
        .d,
      pid = detail.proposals[0].id;
    await assert.rejects(
      action(db, "select", { proposal: pid }),
      /Only the owner/,
    );
    await assert.rejects(action(db, "submit"), /Only the owner/);
    await as(db, owner);
    await action(db, "select", { proposal: pid });
    await action(db, "submit");
    await assert.rejects(
      action(db, "comment", { body: "Change submitted version" }),
      /locked during review/,
    );
    await as(db, head);
    detail = (await db.query("select bank_details($1) as d", [mid])).rows[0].d;
    assert.equal(detail.resource.contributors.length, 2);
    await assert.rejects(
      db.query("select bank_edit($1,$2,$3)", [
        mid,
        { ...d, title: "Mutable review" },
        detail.resource.revision,
      ]),
      /metadata is locked/,
    );
    const checks = {
      objectives: "met",
      content: "met",
      activities: "met",
      assessment: "met",
    };
    await db.query("select bank_decide($1,$2,'approved','',$3)", [
      mid,
      detail.resource.revision,
      checks,
    ]);
    await as(db, stranger);
    list = (await db.query("select bank_list() as d")).rows[0].d;
    assert.equal(list.items[0].contributors[0].name, "Contributor");
    await assert.rejects(
      db.query("select collab_state($1)", [mid]),
      /access denied/,
    );
    await as(db, owner);
    await action(db, "remove", { teacher: member });
    await as(db, member);
    await assert.rejects(
      db.query("select collab_state($1)", [mid]),
      /access denied/,
    );
    await as(db, owner);
    const upload2 = await receipt(db, owner, 2);
    await action(db, "propose", upload2);
    detail = (await db.query("select collab_state($1) as d", [mid])).rows[0].d;
    await action(db, "select", { proposal: detail.proposals[0].id });
    await action(db, "submit");
    await as(db, stranger);
    assert.equal(
      (await db.query("select bank_list() as d")).rows[0].d.total,
      0,
    );
    await as(db, head);
    detail = (await db.query("select bank_details($1) as d", [mid])).rows[0].d;
    assert.equal(detail.versions[0].version, 2);
    assert.equal(detail.versions[0].contributor_credits.length, 1);
    assert.equal(detail.versions[1].contributor_credits.length, 2);
    await db.query("select bank_decide($1,$2,'approved','',$3)", [
      mid,
      detail.resource.revision,
      checks,
    ]);
    await as(db, stranger);
    list = (await db.query("select bank_list() as d")).rows[0].d;
    assert.equal(list.items[0].version, 2);
    assert.equal(list.items[0].contributors.length, 1);
  } finally {
    await db.close();
  }
});
