import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const head = "10000000-0000-4000-8000-000000000001",
  teacher = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003",
  pending = "10000000-0000-4000-8000-000000000004",
  mid = "20000000-0000-4000-8000-000000000001";
test("Requirements, compliance, review checklists and immutable version history are enforced by PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
    await db.exec(await readFile("supabase/setup.sql", "utf8"));
    await db.exec(await readFile("supabase/account-approval.sql", "utf8"));
    await db.exec(
      `insert into auth.users(id,email,email_confirmed_at) values('${head}','head@example.test',now()),('${teacher}','teacher@example.test',now()),('${other}','other@example.test',now()),('${pending}','pending@example.test',now());update profiles set role='head',approval_status='approved' where id='${head}';update profiles set approval_status='approved' where id in ('${teacher}','${other}');`,
    );
    const migration = await readFile("supabase/school-workflow.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    const as = async (uid) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
      ]);
      await db.exec("set role authenticated");
    };
    const details = {
      title: "Quarter 2 module",
      subject: "Science",
      grade: "Grade 5",
      term: "Quarter 2",
      year: "2026–2027",
      due_at: new Date(Date.now() + 86400000).toISOString(),
    };
    await as(teacher);
    await assert.rejects(
      db.query("select create_requirement($1,$2)", [details, [teacher]]),
      /Only a Head Teacher/,
    );
    await as(head);
    await assert.rejects(
      db.query("select create_requirement($1,$2)", [details, [pending]]),
      /approved Teacher/,
    );
    await assert.rejects(
      db.query("select create_requirement($1,$2)", [
        { ...details, due_at: "2020-01-01" },
        [teacher],
      ]),
      /future deadline/,
    );
    const rid = (
      await db.query("select create_requirement($1,$2)", [
        details,
        [teacher, other],
      ])
    ).rows[0].create_requirement;
    let state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.assignments.length, 2);
    assert.ok(
      state.assignments.every((a) => a.status === "missing" && !a.overdue),
    );
    await as(teacher);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.assignments.length, 1);
    assert.equal(state.requirements.length, 1);
    await assert.rejects(
      db.query("select update_requirement($1,1,null,true)", [rid]),
      /Only a Head Teacher/,
    );
    await assert.rejects(
      db.query("update requirements set cancelled=true where id=$1", [rid]),
      /permission denied/,
    );
    const key = teacher + "/" + mid + "/v1.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)",
      [
        "sikap-modules",
        key,
        teacher,
        { size: 40, mimetype: "application/pdf" },
      ],
    );
    await db.query("select submit_module($1,$2,$3,$4,$5,40)", [
      mid,
      { ...details, requirement_id: rid, subject: "Tampered" },
      key,
      "lesson.pdf",
      "application/pdf",
    ]);
    let module = (await db.query("select * from modules where id=$1", [mid]))
      .rows[0];
    assert.equal(module.subject, "Science");
    assert.equal(module.requirement_id, rid);
    await assert.rejects(
      db.query("select submit_module(gen_random_uuid(),$1,$2,$3,$4,40)", [
        { ...details, requirement_id: rid },
        key,
        "copy.pdf",
        "application/pdf",
      ]),
      /Already submitted/,
    );
    await db.exec("reset role");
    await db.query(
      "update requirements set due_at=now()-interval '1 hour' where id=$1",
      [rid],
    );
    await as(head);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(
      state.assignments.find((a) => a.teacher_id === teacher).late,
      true,
    );
    assert.equal(
      state.assignments.find((a) => a.teacher_id === other).overdue,
      true,
    );
    const met = {
        objectives: "met",
        content: "met",
        activities: "met",
        assessment: "met",
      },
      revise = { ...met, assessment: "revise" };
    await assert.rejects(
      db.query("select review_module($1,1,'approved','')", [mid]),
      /checklist/,
    );
    await assert.rejects(
      db.query(
        "select sikap_private.workflow_review_base($1,1,'approved','')",
        [mid],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select review_module_checked($1,1,'approved','',$2)", [
        mid,
        {},
      ]),
      /checklist/,
    );
    await assert.rejects(
      db.query("select review_module_checked($1,1,'approved','',$2)", [
        mid,
        revise,
      ]),
      /Resolve checklist/,
    );
    await assert.rejects(
      db.query("select review_module_checked($1,1,'returned','',$2)", [
        mid,
        revise,
      ]),
      /explain/,
    );
    await db.query(
      "select review_module_checked($1,1,'returned','Add an answer key on page 4.',$2)",
      [mid, revise],
    );
    await as(teacher);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.reviews.length, 1);
    assert.equal(state.reviews[0].checklist.assessment, "revise");
    assert.equal(state.assignments[0].overdue, true);
    await assert.rejects(
      db.query("select review_module_checked($1,2,'approved','',$2)", [
        mid,
        met,
      ]),
      /Head Teacher/,
    );
    const key2 = teacher + "/" + mid + "/v2.pdf";
    await db.query(
      "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)",
      [
        "sikap-modules",
        key2,
        teacher,
        { size: 40, mimetype: "application/pdf" },
      ],
    );
    await db.query("select revise_module($1,2,$2,$3,$4,40,$5)", [
      mid,
      key2,
      "revision.pdf",
      "application/pdf",
      "Added page 4 answer key",
    ]);
    await as(head);
    await assert.rejects(
      db.query("select review_module_checked($1,1,'approved','',$2)", [
        mid,
        met,
      ]),
      /changed/,
    );
    await db.query(
      "select review_module_checked($1,3,'approved','Answer key checked',$2)",
      [mid, met],
    );
    await as(teacher);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.reviews.length, 2);
    assert.equal(state.assignments[0].status, "approved");
    assert.equal(state.assignments[0].overdue, false);
    assert.equal(
      (await db.query("select module_details($1)", [mid])).rows[0]
        .module_details.versions.length,
      2,
    );
    await as(other);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.reviews.length, 0);
    await assert.rejects(
      db.query("select module_details($1)", [mid]),
      /access denied/,
    );
    await as(pending);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.requirements.length, 0);
    await as(head);
    await db.query(
      "select update_requirement($1,1,now()+interval '2 days',false)",
      [rid],
    );
    await assert.rejects(
      db.query("select update_requirement($1,1,null,true)", [rid]),
      /changed/,
    );
    await db.query("select update_requirement($1,2,null,true)", [rid]);
    state = (await db.query("select get_workflow_state()")).rows[0]
      .get_workflow_state;
    assert.equal(state.requirements[0].cancelled, true);
    assert.ok(state.assignments.every((a) => !a.overdue));
    assert.equal(state.requirementEvents.length, 3);
    await as(other);
    await assert.rejects(
      db.query("select submit_module(gen_random_uuid(),$1,$2,$3,$4,40)", [
        { ...details, requirement_id: rid },
        key,
        "copy.pdf",
        "application/pdf",
      ]),
      /unavailable/,
    );
  } finally {
    await db.close();
  }
});
