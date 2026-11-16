import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { docxFixture } from "./docx-fixture.mjs";
import { validateResourceFile } from "../src/lib/resource-file.js";
import { ZipWriter, Uint8ArrayWriter, TextReader } from "@zip.js/zip.js";

const teacher = "10000000-0000-4000-8000-000000000001",
  head = "10000000-0000-4000-8000-000000000004",
  PPTX =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const resource = {
  title: "Rice terraces of Nueva Ecija",
  category: "UNITS",
  subject: "Science",
  grade: "Grade 8",
  term: "Term 2",
  description: "Slides on local rice farming",
  competency: "Explain energy flow in a local ecosystem",
  localization: "Uses rice fields near the school",
  tags: ["rice"],
};
const moduleId = (n) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function as(db, id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function upload(db, mid, filename, mime) {
  await db.exec("reset role");
  const key = `${teacher}/${mid}/${filename}`;
  await db.query(
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values('sikap-modules',$1,$2,$3)",
    [key, teacher, { size: 40, mimetype: mime }],
  );
  await db.query(
    "insert into bank_uploads(key,owner,module,filename,mime,bytes,sha256) values($1,$2,$3,$4,$5,40,$6)",
    [key, teacher, mid, filename, mime, "a".repeat(64)],
  );
  await as(db, teacher);
  return key;
}
async function pptxFixture(withPresentation = true) {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add("[Content_Types].xml", new TextReader("<Types/>"));
  if (withPresentation)
    await writer.add(
      "ppt/presentation.xml",
      new TextReader("<p:presentation/>"),
    );
  return writer.close();
}

test("Proposal alignment: PPTX files and term labels are accepted, existing PDF/DOCX and quarter labels keep working", async () => {
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
      "proposal-alignment",
      "proposal-alignment",
    ])
      await db.exec(await readFile(`supabase/${f}.sql`, "utf8"));
    for (const [id, name] of [
      [teacher, "Teacher"],
      [head, "Reviewer"],
    ])
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
        [id, `${name}@example.test`, { name }],
      );
    await db.exec(
      `update profiles set approval_status='approved';update profiles set role='head' where id='${head}';`,
    );

    const bucket = (
      await db.query(
        "select allowed_mime_types from storage.buckets where id='sikap-modules'",
      )
    ).rows[0].allowed_mime_types;
    assert.ok(bucket.includes(PPTX) && bucket.includes("application/pdf"));

    // A slide deck labeled by term is submitted for review.
    await as(db, teacher);
    let key = await upload(db, moduleId(1), "rice-terraces.pptx", PPTX);
    await db.query("select bank_save($1,$2,null,$3,true)", [
      moduleId(1),
      resource,
      key,
    ]);
    // Resources labeled "Quarter" (the live site until it is republished) still save.
    key = await upload(db, moduleId(2), "lesson.pdf", "application/pdf");
    await db.query("select bank_save($1,$2,null,$3,true)", [
      moduleId(2),
      { ...resource, term: "Quarter 1" },
      key,
    ]);
    await assert.rejects(
      db.query("select bank_save($1,$2,null,null,false)", [
        moduleId(3),
        { ...resource, term: "Term 4" },
      ]),
      /grade and term/,
    );
    // Old PowerPoint (.ppt) files stay rejected.
    key = await upload(
      db,
      moduleId(4),
      "old.ppt",
      "application/vnd.ms-powerpoint",
    );
    await assert.rejects(
      db.query("select bank_save($1,$2,null,$3,true)", [
        moduleId(4),
        resource,
        key,
      ]),
      /Invalid file/,
    );

    await db.exec("reset role");
    const saved = (
      await db.query(
        "select m.term,v.type from modules m join versions v on v.module=m.id where m.id=$1",
        [moduleId(1)],
      )
    ).rows[0];
    assert.deepEqual(saved, { term: "Term 2", type: PPTX });

    // LRMDS descriptors: saved when sent, kept when an older client omits
    // them, and limited to the listed values.
    const lrmds = {
      resource_type: "Slide deck",
      language: "Filipino",
      rights: "Original work",
    };
    const descriptors = async (id) =>
      (
        await db.query(
          "select bank_resource_type,bank_language,bank_rights from modules where id=$1",
          [id],
        )
      ).rows[0];
    await as(db, teacher);
    await db.query("select bank_save($1,$2,null,null,false)", [
      moduleId(5),
      { ...resource, ...lrmds },
    ]);
    const draftRevision = async () =>
      (
        await db.query("select revision from modules where id=$1", [
          moduleId(5),
        ])
      ).rows[0].revision;
    await db.query("select bank_save($1,$2,$3,null,false)", [
      moduleId(5),
      { ...resource, title: "Renamed by an older client" },
      await draftRevision(),
    ]);
    await assert.rejects(
      db.query("select bank_save($1,$2,$3,null,false)", [
        moduleId(5),
        { ...resource, ...lrmds, resource_type: "Video" },
        await draftRevision(),
      ]),
      /listed resource type/,
    );
    await assert.rejects(
      db.query("select bank_save_before_lrmds($1,$2,2,null,false)", [
        moduleId(5),
        resource,
      ]),
      /permission denied/,
    );
    await db.exec("reset role");
    assert.deepEqual(await descriptors(moduleId(5)), {
      bank_resource_type: "Slide deck",
      bank_language: "Filipino",
      bank_rights: "Original work",
    });
    assert.deepEqual(await descriptors(moduleId(2)), {
      bank_resource_type: null,
      bank_language: null,
      bank_rights: null,
    });
    // A Head Teacher fills them in on an existing resource with Edit details.
    await as(db, head);
    const revision = (
      await db.query("select bank_details($1) as d", [moduleId(2)])
    ).rows[0].d.resource.revision;
    await db.query("select bank_edit($1,$2,$3)", [
      moduleId(2),
      { ...resource, term: "Term 1", ...lrmds, language: "English" },
      revision,
    ]);
    const detail = (
      await db.query("select bank_details($1) as d", [moduleId(2)])
    ).rows[0].d.resource;
    assert.equal(detail.bank_language, "English");
    assert.equal(detail.term, "Term 1");
    // Resource cards read the type from the list.
    const listed = (
      await db.query("select bank_list($1,1) as d", [{ scope: "all" }])
    ).rows[0].d.items;
    assert.equal(
      listed.find((item) => item.id === moduleId(2)).bank_resource_type,
      "Slide deck",
    );
    assert.equal(
      listed.find((item) => item.id === moduleId(1)).bank_resource_type,
      null,
    );
    await assert.rejects(
      db.query("select bank_list_before_lrmds('{}',1)"),
      /permission denied/,
    );
    await db.exec("reset role");

    // Competency catalog entries may name a term.
    const entry =
      "insert into curriculum_competencies(learning_area,grade,quarter,competency_text,curriculum_version,source_title,source_url,source_page) values('Science','Grade 8',$1,'Explain energy flow','MATATAG','Science guide','https://example.test/guide.pdf','12')";
    await db.query(entry, ["Term 2"]);
    await assert.rejects(db.query(entry, ["Term 4"]), /check constraint/);
  } finally {
    await db.close();
  }
});

test("Client and server file check accepts real PPTX slide decks only", async () => {
  assert.equal(
    await validateResourceFile(new File([await pptxFixture()], "slides.pptx")),
    PPTX,
  );
  await assert.rejects(
    validateResourceFile(new File([await pptxFixture(false)], "slides.pptx")),
    /valid PowerPoint PPTX/,
  );
  await assert.rejects(
    validateResourceFile(new File([await docxFixture()], "slides.pptx")),
    /valid PowerPoint PPTX/,
  );
  await assert.rejects(
    validateResourceFile(new File(["%PDF-1.4"], "slides.pptx")),
    /valid PPTX/,
  );
  await assert.rejects(
    validateResourceFile(new File(["x"], "slides.ppt")),
    /PowerPoint \(PPTX\)/,
  );
});
