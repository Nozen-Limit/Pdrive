import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const head = "10000000-0000-4000-8000-000000000001",
  teacher = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003",
  pending = "10000000-0000-4000-8000-000000000004";
const mid = "20000000-0000-4000-8000-000000000001";
const metadata = {
  title: "Localized fractions activity",
  category: "UNITS",
  subject: "Mathematics",
  grade: "Grade 7",
  term: "Quarter 2",
  description: "Fractions using local market prices",
  competency: "Represent and compare fractions",
  localization: "Use market examples from the school community",
  tags: ["fractions", "market"],
  source: "Teacher original",
  notes: "",
};
const checks = {
  objectives: "met",
  content: "met",
  activities: "met",
  assessment: "met",
};
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of [
    "setup",
    "account-approval",
    "school-workflow",
    "digital-bank",
    "digital-bank",
  ])
    await db.exec(await readFile(`supabase/${file}.sql`, "utf8"));
  await db.exec(
    `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${head}','head@example.test',now(),'{"name":"Reviewer"}'),('${teacher}','teacher@example.test',now(),'{"name":"Original Creator"}'),('${other}','other@example.test',now(),'{"name":"Other Teacher"}'),('${pending}','pending@example.test',now(),'{}');update profiles set approval_status='approved' where id<>'${pending}';update profiles set role='head' where id='${head}';`,
  );
  return db;
}
async function as(db, user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function receipt(db, version, id = mid, owner = teacher) {
  await db.exec("reset role");
  const key = `${owner}/${id}/v${version}.pdf`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('sikap-modules',$1,$2,$3)",
    [key, owner, { size: 40, mimetype: "application/pdf" }],
  );
  await db.query(
    "insert into bank_uploads(key,owner,module,filename,mime,bytes,sha256) values($1,$2,$3,'resource.pdf','application/pdf',40,$4)",
    [key, owner, id, "a".repeat(64)],
  );
  return key;
}
async function detail(db) {
  return (await db.query("select bank_details($1) as value", [mid])).rows[0]
    .value;
}
async function list(db, filters = {}, page = 1) {
  return (await db.query("select bank_list($1,$2) as value", [filters, page]))
    .rows[0].value;
}
test("Digital Bank: complete return/revision/approval workflow, shared final version, immutable creator and server authorization", async () => {
  const db = await database();
  try {
    await as(db, pending);
    await assert.rejects(list(db), /approval required/);
    await as(db, teacher);
    await assert.rejects(
      db.query(
        "insert into bank_uploads(key,owner,module,filename,mime,bytes,sha256) values('fake',$1,$2,'x.pdf','application/pdf',40,$3)",
        [teacher, mid, "a".repeat(64)],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select bank_save($1,$2,null,'fake',true)", [mid, metadata]),
      /Upload the file/,
    );
    await db.query("select bank_save($1,$2,null,null,false)", [mid, metadata]);
    let resource = (await detail(db)).resource;
    assert.equal(resource.bank_draft, true);
    assert.equal((await list(db, { scope: "mine" })).items[0].state, "draft");
    await as(db, other);
    await assert.rejects(detail(db), /access denied/);
    const key1 = await receipt(db, 1);
    await as(db, teacher);
    await db.query("select bank_save($1,$2,$3,$4,true)", [
      mid,
      metadata,
      resource.revision,
      key1,
    ]);
    resource = (await detail(db)).resource;
    assert.equal((await list(db)).total, 0);
    assert.equal(
      (await db.query("select get_state() as value")).rows[0].value.modules
        .length,
      0,
    );
    await assert.rejects(
      db.query("select bank_decide($1,$2,'approved','',$3)", [
        mid,
        resource.revision,
        checks,
      ]),
      /different approved Head/,
    );
    await as(db, head);
    assert.equal((await list(db, { scope: "review" })).total, 1);
    await assert.rejects(
      db.query("select bank_decide($1,$2,'returned','',$3)", [
        mid,
        resource.revision,
        { ...checks, assessment: "revise" },
      ]),
      /feedback/,
    );
    await db.query(
      "select bank_decide($1,$2,'returned','Add the answer key',$3)",
      [mid, resource.revision, { ...checks, assessment: "revise" }],
    );
    await as(db, teacher);
    let current = await detail(db);
    resource = current.resource;
    assert.equal(current.reviews[0].feedback, "Add the answer key");
    assert.equal(current.versions.length, 1);
    const key2 = await receipt(db, 2);
    await as(db, teacher);
    await assert.rejects(
      db.query(
        "select revise_module($1,$2,$3,'resource.pdf','application/pdf',40,'Bypass')",
        [mid, resource.revision, key2],
      ),
      /Digital Bank workflow/,
    );
    await db.query("select bank_revise($1,$2,$3,'Added answer key')", [
      mid,
      resource.revision,
      key2,
    ]);
    current = await detail(db);
    resource = current.resource;
    assert.equal(current.versions.length, 2);
    assert.equal(
      (await list(db, { scope: "mine" })).items[0].state,
      "resubmitted",
    );
    await as(db, head);
    await assert.rejects(
      db.query("select bank_decide($1,$2,'approved','',$3)", [
        mid,
        resource.revision - 1,
        checks,
      ]),
      /Resource changed/,
    );
    await assert.rejects(
      db.query("select review_module_checked($1,$2,'approved','',$3)", [
        mid,
        resource.revision,
        checks,
      ]),
      /Digital Bank workflow/,
    );
    await db.query("select bank_decide($1,$2,'approved','Ready for use',$3)", [
      mid,
      resource.revision,
      checks,
    ]);
    current = await detail(db);
    resource = current.resource;
    assert.equal(resource.final_version, 2);
    assert.equal(resource.approver, head);
    assert.ok(resource.approved);
    assert.equal(resource.owner, teacher);
    assert.equal(resource.creator, "Original Creator");
    await db.query("select bank_edit($1,$2,$3)", [
      mid,
      { ...metadata, tags: ["fractions", "approved"] },
      resource.revision,
    ]);
    resource = (await detail(db)).resource;
    assert.equal(resource.creator, "Original Creator");
    await as(db, other);
    const found = await list(db, {
      q: "Mathematics",
      category: "UNITS",
      grade: "Grade 7",
      term: "Quarter 2",
    });
    assert.equal(found.total, 1);
    assert.equal((await list(db, { q: "approved" })).total, 1);
    assert.equal((await list(db, { grade: "Grade 8" })).total, 0);
    current = await detail(db);
    assert.equal(current.private, false);
    assert.equal(current.versions.length, 1);
    assert.equal(current.versions[0].version, 2);
    assert.equal(current.reviews.length, 1);
    assert.equal(current.events.length, 0);
    assert.equal(
      (await db.query("select name from storage.objects where name=$1", [key1]))
        .rows.length,
      0,
    );
    assert.equal(
      (await db.query("select name from storage.objects where name=$1", [key2]))
        .rows.length,
      1,
    );
    await assert.rejects(
      db.query("select module_details($1)", [mid]),
      /access denied/,
    );
    await assert.rejects(
      db.query("select bank_edit($1,$2,$3)", [
        mid,
        metadata,
        resource.revision,
      ]),
      /cannot be edited/,
    );
    await db.query("insert into stars(owner,module) values($1,$2)", [
      other,
      mid,
    ]);
    assert.equal((await list(db, { scope: "saved" })).total, 1);
    await assert.rejects(list(db, { scope: "review" }), /access denied/);
    await assert.rejects(
      db.query("select bank_archive($1,$2,true)", [mid, resource.revision]),
      /Only a Head/,
    );
    await as(db, head);
    await db.query("select bank_archive($1,$2,true)", [mid, resource.revision]);
    assert.equal((await list(db, { scope: "archived" })).total, 1);
    await as(db, other);
    assert.equal((await list(db)).total, 0);
    assert.equal((await list(db, { scope: "saved" })).total, 0);
    await assert.rejects(detail(db), /access denied/);
    assert.equal(
      (await db.query("select name from storage.objects where name=$1", [key2]))
        .rows.length,
      0,
    );
    await as(db, teacher);
    assert.equal((await detail(db)).versions.length, 2);
  } finally {
    await db.close();
  }
});
test("Digital Bank: pagination, draft deletion, metadata validation and self-review prevention", async () => {
  const db = await database();
  try {
    await as(db, head);
    await assert.rejects(
      db.query("select bank_save($1,$2,null,null,false)", [
        mid,
        { ...metadata, category: "OTHER" },
      ]),
      /Choose Methods/,
    );
    await assert.rejects(
      db.query("select bank_save($1,$2,null,null,false)", [
        mid,
        { ...metadata, grade: "Grade 6" },
      ]),
      /Junior High School/,
    );
    await assert.rejects(
      db.query("select bank_save($1,$2,null,null,false)", [
        mid,
        { ...metadata, tags: [] },
      ]),
      /tags/,
    );
    for (let i = 1; i <= 27; i++)
      await db.query("select bank_save($1,$2,null,null,false)", [
        `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        { ...metadata, title: "Draft " + String(i).padStart(2, "0") },
      ]);
    const page1 = await list(db, { scope: "mine", sort: "name" });
    const page2 = await list(db, { scope: "mine", sort: "name" }, 2);
    assert.equal(page1.total, 27);
    assert.equal(page1.items.length, 25);
    assert.equal(page2.items.length, 2);
    assert.equal(page1.items[0].title, "Draft 01");
    const draft = page1.items[0];
    await db.query("select bank_delete_draft($1,$2)", [
      draft.id,
      draft.revision,
    ]);
    assert.equal((await list(db, { scope: "mine" })).total, 26);
    const key = await receipt(db, 1, mid, head);
    await as(db, head);
    await db.query("select bank_save($1,$2,null,$3,true)", [
      mid,
      metadata,
      key,
    ]);
    const resource = (await detail(db)).resource;
    await assert.rejects(
      db.query("select bank_decide($1,$2,'approved','',$3)", [
        mid,
        resource.revision,
        checks,
      ]),
      /different approved Head/,
    );
    await assert.rejects(
      db.query("select bank_delete_draft($1,$2)", [mid, resource.revision]),
      /Draft changed/,
    );
    await as(db, teacher);
    assert.equal((await list(db, { scope: "mine" })).total, 0);
  } finally {
    await db.close();
  }
});
