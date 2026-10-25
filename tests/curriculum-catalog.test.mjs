import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const head = "10000000-0000-4000-8000-000000000001";
const teacher = "10000000-0000-4000-8000-000000000002";
const pending = "10000000-0000-4000-8000-000000000003";
const legacy = "20000000-0000-4000-8000-000000000001";
const mapped = "20000000-0000-4000-8000-000000000002";
const metadata = {
  title: "Test fixture only",
  category: "UNITS",
  subject: "Science",
  grade: "Grade 7",
  term: "Quarter 2",
  description: "Test description",
  competency: "Old free text is retained",
  localization: "Local classroom example",
  tags: ["fixture"],
};
const entry = {
  learning_area: "Science",
  grade: "Grade 7",
  quarter: "Quarter 2",
  official_code: null,
  competency_text: "TEST FIXTURE ONLY: reviewed text, not official curriculum.",
  curriculum_version: "TEST FIXTURE edition",
  source_title: "TEST FIXTURE guide",
  source_url: "https://example.test/fixture.pdf",
  source_page: "12",
};
async function as(db, user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of [
    "setup",
    "account-approval",
    "school-workflow",
    "digital-bank",
  ])
    await db.exec(await readFile(`supabase/${file}.sql`, "utf8"));
  await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
    ('${head}','head@example.test',now(),'{"name":"Reviewer"}'),
    ('${teacher}','teacher@example.test',now(),'{"name":"Teacher"}'),
    ('${pending}','pending@example.test',now(),'{}');
    update profiles set approval_status='approved' where id<>'${pending}';
    update profiles set role='head' where id='${head}';`);
  await as(db, teacher);
  await db.query("select bank_save($1,$2)", [legacy, metadata]);
  await db.exec("reset role");
  const migration = await readFile("supabase/curriculum-catalog.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  return { db, migration };
}
async function importAndVerify(db, value = entry) {
  await as(db, head);
  await db.query("select bank_competency_import($1)", [[value]]);
  const id = (
    await db.query(
      "select id from curriculum_competencies where competency_text=$1",
      [value.competency_text],
    )
  ).rows[0].id;
  await db.query(
    "select bank_competency_review($1,1,'verified','Checked test source and grade')",
    [id],
  );
  return id;
}

test("Curriculum upgrade preserves old resources and is rerunnable without resetting enforcement", async () => {
  const { db, migration } = await setup();
  try {
    await as(db, teacher);
    const initial = (await db.query("select bank_details($1) as d", [legacy]))
      .rows[0].d.resource;
    assert.equal(initial.bank_competency, metadata.competency);
    assert.equal(initial.bank_competency_legacy, true);
    assert.equal(initial.bank_competency_id, null);
    assert.equal(
      (await db.query("select bank_curriculum() as d")).rows[0].d.enforced,
      false,
    );
    assert.equal(
      (await db.query("select bank_curriculum() as d")).rows[0].d.learning_areas
        .length,
      9,
    );
    await db.query("select bank_save($1,$2)", [mapped, metadata]);
    await db.exec(
      "reset role;update curriculum_settings set enforce_catalog=true where singleton",
    );
    await db.exec(migration);
    assert.equal(
      (await db.query("select enforce_catalog from curriculum_settings"))
        .rows[0].enforce_catalog,
      true,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from modules")).rows[0].n,
      2,
    );
    await as(db, teacher);
    await assert.rejects(
      db.query("select bank_save($1,$2)", [
        "20000000-0000-4000-8000-000000000003",
        metadata,
      ]),
      /verified learning competency/,
    );
    const list = (
      await db.query(
        'select bank_list(\'{"scope":"mine","legacy":"true"}\') as d',
      )
    ).rows[0].d;
    assert.equal(list.total, 2);
  } finally {
    await db.close();
  }
});

test("Only approved heads import/review; teachers cannot read drafts or directly write catalog tables", async () => {
  const { db } = await setup();
  try {
    await as(db, teacher);
    await assert.rejects(
      db.query("select bank_competency_import($1)", [[entry]]),
      /Head Teacher/,
    );
    await assert.rejects(
      db.exec("update curriculum_settings set enforce_catalog=true"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("update curriculum_competencies set status='verified'"),
      /permission denied/,
    );
    await as(db, head);
    const imported = (
      await db.query("select bank_competency_import($1) as d", [
        [{ ...entry, status: "verified", verified_by: head }],
      ])
    ).rows[0].d;
    assert.equal(imported.imported, 1);
    assert.equal(imported.status, "draft");
    assert.equal(
      (await db.query("select bank_competency_import($1) as d", [[entry]]))
        .rows[0].d.duplicates,
      1,
    );
    const id = (await db.query("select id from curriculum_competencies"))
      .rows[0].id;
    await as(db, teacher);
    assert.equal(
      (await db.query("select * from curriculum_competencies")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select bank_competency_list() as d")).rows[0].d.total,
      0,
    );
    await assert.rejects(
      db.query(
        "select bank_competency_review($1,1,'verified','Fake verification')",
        [id],
      ),
      /Head Teacher/,
    );
    await assert.rejects(
      db.query("select bank_save($1,$2)", [
        mapped,
        { ...metadata, competency_id: id },
      ]),
      /not verified/,
    );
    await as(db, pending);
    await assert.rejects(db.query("select bank_curriculum()"), /approval/);
    await as(db, head);
    await db.query(
      "select bank_competency_review($1,1,'verified','Checked source')",
      [id],
    );
    await assert.rejects(
      db.query("select bank_competency_review($1,1,'retired','Stale')", [id]),
      /changed/,
    );
    await as(db, teacher);
    assert.equal(
      (await db.query("select bank_competency_list() as d")).rows[0].d.total,
      1,
    );
    await assert.rejects(
      db.exec("select bank_competency_coverage()"),
      /Head Teacher/,
    );
  } finally {
    await db.close();
  }
});

test("Verified selection enforces grade/area/quarter and canonical text, code and source even for direct writes", async () => {
  const { db } = await setup();
  try {
    const id = await importAndVerify(db);
    await db.exec(
      "reset role;update curriculum_settings set enforce_catalog=true where singleton",
    );
    await as(db, teacher);
    for (const patch of [
      { subject: "Sci" },
      { grade: "Grade 8" },
      { term: "Quarter 3" },
    ])
      await assert.rejects(
        db.query("select bank_save($1,$2)", [
          mapped,
          { ...metadata, competency_id: id, ...patch },
        ]),
        /does not match/,
      );
    await db.query("select bank_save($1,$2)", [
      mapped,
      {
        ...metadata,
        competency_id: id,
        competency: "Forged wording",
        competency_code: "FAKE-CODE",
      },
    ]);
    const r = (await db.query("select bank_details($1) as d", [mapped])).rows[0]
      .d.resource;
    assert.equal(r.bank_competency, entry.competency_text);
    assert.equal(r.bank_competency_code, null);
    assert.equal(r.bank_competency_legacy, false);
    assert.deepEqual(r.bank_competency_source, {
      title: entry.source_title,
      url: entry.source_url,
      page: entry.source_page,
    });
    await db.exec("reset role");
    await assert.rejects(
      db.query("update modules set subject='Sci' where id=$1", [mapped]),
      /does not match/,
    );
    await assert.rejects(
      db.query(
        "update modules set bank_competency_id=null,bank_competency_legacy=false where id=$1",
        [mapped],
      ),
      /verified learning competency/,
    );
    await db.query(
      "update modules set bank_competency='Forged',bank_competency_code='FAKE' where id=$1",
      [mapped],
    );
    assert.equal(
      (
        await db.query("select bank_competency from modules where id=$1", [
          mapped,
        ])
      ).rows[0].bank_competency,
      entry.competency_text,
    );
    // Archive/status changes on existing legacy data still work after activation.
    await db.query("update modules set archived=true where id=$1", [legacy]);
  } finally {
    await db.close();
  }
});

test("Coverage excludes archived work; version snapshots preserve wording; retired entries reject new submissions", async () => {
  const { db } = await setup();
  try {
    const id = await importAndVerify(db, {
      ...entry,
      official_code: "TEST-ONLY-01",
    });
    await as(db, head);
    let coverage = (await db.query("select bank_competency_coverage() as d"))
      .rows[0].d;
    assert.equal(coverage.without_approved_resource, 1);
    await as(db, teacher);
    await db.query("select bank_save($1,$2)", [
      mapped,
      { ...metadata, competency_id: id },
    ]);
    await db.exec("reset role");
    await db.query(
      "update modules set status='approved',bank_draft=false,final_version=1 where id=$1",
      [mapped],
    );
    await db.query(
      "insert into versions(module,version,key,name,type,size,changes) values($1,1,'test.pdf','test.pdf','application/pdf',30,'Test')",
      [mapped],
    );
    const snapshot = (
      await db.query(
        "select bank_competency_text,bank_competency_code,bank_competency_legacy from versions where module=$1",
        [mapped],
      )
    ).rows[0];
    assert.deepEqual(snapshot, {
      bank_competency_text: entry.competency_text,
      bank_competency_code: "TEST-ONLY-01",
      bank_competency_legacy: false,
    });
    await as(db, head);
    coverage = (await db.query("select bank_competency_coverage() as d"))
      .rows[0].d;
    assert.equal(coverage.without_approved_resource, 0);
    await db.query("select bank_archive($1,2,true)", [mapped]);
    assert.equal(
      (await db.query("select bank_competency_coverage() as d")).rows[0].d
        .without_approved_resource,
      1,
    );
    await db.query(
      "select bank_competency_review($1,2,'retired','Outdated guide')",
      [id],
    );
    await as(db, teacher);
    await assert.rejects(
      db.query("select bank_save($1,$2)", [
        "20000000-0000-4000-8000-000000000003",
        { ...metadata, competency_id: id },
      ]),
      /not verified/,
    );
    assert.equal(
      (await db.query("select bank_competency_list() as d")).rows[0].d.total,
      0,
    );
    assert.equal(
      (await db.query("select bank_details($1) as d", [mapped])).rows[0].d
        .versions[0].bank_competency_code,
      "TEST-ONLY-01",
    );
  } finally {
    await db.close();
  }
});
