import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as m from "../mock/collaboration/model.js";
import { inspectFile } from "../mock/collaboration/files.js";
const checks = {
  objectives: "met",
  content: "met",
  activities: "met",
  assessment: "met",
};
test("Shared drafts require accepted invitations; only the owner selects files and submits a fixed snapshot", () => {
  const state = m.initialState(),
    r = m.resource(state, "water-cycle");
  m.invite(state, r.id, "tom", "jose");
  assert.equal(m.canSee(r, "jose"), false);
  assert.throws(() => m.comment(state, r.id, "jose", "A suggestion"), /locked/);
  m.answerInvite(state, r.id, "jose", false);
  assert.equal(m.member(r, "jose"), false);
  m.invite(state, r.id, "tom", "jose");
  m.answerInvite(state, r.id, "jose", true);
  assert.equal(m.canSee(r, "jose"), true);
  assert.throws(() => m.invite(state, r.id, "mara", "jose"), /owner/);
  m.comment(state, r.id, "jose", "Add local market examples.");
  m.propose(state, r.id, "jose", "Suggested activity", {
    ...r.working.attachment,
    name: "jose.pptx",
  });
  const proposal = r.proposals.at(-1);
  assert.throws(
    () => m.selectProposal(state, r.id, "mara", proposal.id),
    /owner/,
  );
  m.selectProposal(state, r.id, "tom", proposal.id);
  assert.equal(r.working.attachment.name, "jose.pptx");
  assert.throws(() => m.submit(state, r.id, "mara"), /owner/);
  const version = m.submit(state, r.id, "tom");
  assert.equal(r.working, null);
  assert.deepEqual(version.contributors, ["tom", "mara", "jose"]);
  for (const work of [
    () => m.comment(state, r.id, "mara", "New change"),
    () => m.propose(state, r.id, "jose", "New proposal"),
    () => m.invite(state, r.id, "tom", "jose"),
  ])
    assert.throws(work, /locked/);
  assert.throws(
    () => m.review(state, r.id, "tom", "approved", checks, ""),
    /Head Teacher/,
  );
  assert.throws(
    () =>
      m.review(
        state,
        r.id,
        "leon",
        "approved",
        { ...checks, assessment: "revise" },
        "",
      ),
    /Resolve/,
  );
  const snapshot = structuredClone(version.attachment);
  m.review(
    state,
    r.id,
    "leon",
    "returned",
    { ...checks, assessment: "revise" },
    "Add an answer key.",
  );
  m.updateDraft(
    state,
    r.id,
    "tom",
    { ...snapshot, name: "revised.pptx" },
    "Added answer key",
  );
  assert.deepEqual(
    version.attachment,
    snapshot,
    "returned/submitted package is not overwritten by working files",
  );
});
test("Approved files remain published while a new revision is prepared and reviewed; credits and paired files are versioned", () => {
  const state = m.initialState(),
    r = m.resource(state, "plant-video"),
    original = structuredClone(r.versions[0]);
  m.startRevision(state, r.id, "tom");
  m.answerInvite(state, r.id, "jose", true);
  m.propose(state, r.id, "jose", "A local demonstration", {
    ...r.working.attachment,
    name: "new-video.mp4",
    sample: false,
  });
  m.selectProposal(state, r.id, "tom", r.proposals.at(-1).id);
  m.submit(state, r.id, "tom");
  assert.equal(r.published, 1);
  assert.deepEqual(r.versions[0], original);
  assert.equal(
    m.canSee(r, "mara"),
    true,
    "prior approved resource is still shared",
  );
  m.review(state, r.id, "leon", "approved", checks, "Ready");
  assert.equal(r.published, 2);
  assert.deepEqual(r.versions[1].contributors, ["tom", "jose"]);
  assert.throws(() => m.archive(state, r.id, "tom", true), /Head Teacher/);
  m.archive(state, r.id, "leon", true);
  m.archive(state, r.id, "leon", false);
  assert.equal(r.published, 2);
  assert.equal(r.status, "approved");
  const deck = m.resource(state, "water-cycle");
  deck.working.attachment.preview = null;
  assert.throws(() => m.submit(state, deck.id, "tom"), /PDF review copy/);
  m.startRevision(state, r.id, "tom");
  r.working.attachment.permission = false;
  assert.throws(() => m.submit(state, r.id, "tom"), /permission/);
});
test("Mock file policy recognizes real slide/PDF fixtures and applies audio/video size and duration limits", async () => {
  for (const ext of ["pptx", "pdf"]) {
    const file = new File(
      [await readFile(`mock/collaboration/assets/water-cycle.${ext}`)],
      `test.${ext}`,
    );
    assert.equal((await inspectFile(file)).type, ext);
  }
  await assert.rejects(
    inspectFile(new File(["invalid"], "fake.pptx")),
    /valid/,
  );
  const video = new File(
    [new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109])],
    "test.mp4",
  );
  assert.equal((await inspectFile(video, async () => 60)).duration, 60);
  await assert.rejects(
    inspectFile(video, async () => 601),
    /10 minutes/,
  );
  await assert.rejects(
    inspectFile(video, async () => Infinity),
    /10 minutes/,
  );
  const audio = new File(["ID3mock"], "test.mp3");
  assert.equal((await inspectFile(audio, async () => 90)).type, "mp3");
  await assert.rejects(
    inspectFile(audio, async () => 1201),
    /20 minutes/,
  );
  await assert.rejects(
    inspectFile({ name: "big.mp3", size: 26 * 1024 * 1024 }),
    /25 MB/,
  );
  await assert.rejects(
    inspectFile({ name: "big.pdf", size: 21 * 1024 * 1024 }),
    /20 MB/,
  );
  await assert.rejects(inspectFile(new File(["not audio"], "bad.mp3")), /MP3/);
  await assert.rejects(inspectFile(new File(["not video"], "bad.mp4")), /MP4/);
});
test("Digital Bank collaboration rows exclude drafts and archived work, filter results, and retain the approved revision", () => {
  const state = m.initialState(),
    r = m.resource(state, "water-cycle");
  assert.equal(
    m.publishedResources(state).some((x) => x.id === r.id),
    false,
  );
  m.submit(state, r.id, "tom");
  assert.equal(
    m.publishedResources(state).some((x) => x.id === r.id),
    false,
  );
  m.review(state, r.id, "leon", "approved", checks, "Ready");
  const row = m.publishedResources(state, {
    q: "water cycle",
    category: "UNITS",
  })[0];
  assert.equal(row.id, r.id);
  assert.deepEqual(row.credits, ["Tom Jerald Ferrer", "Mara Santos"]);
  assert.equal(
    m.publishedResources(state, { q: "water cycle", subject: "Mathematics" })
      .length,
    0,
  );
  m.startRevision(state, r.id, "tom");
  m.updateDraft(
    state,
    r.id,
    "tom",
    { ...r.working.attachment, name: "unapproved.pptx" },
    "New content",
  );
  m.submit(state, r.id, "tom");
  assert.deepEqual(m.publishedResources(state, { q: "water cycle" })[0], row);
  m.review(state, r.id, "leon", "approved", checks, "Ready");
  assert.equal(m.publishedResources(state, { q: "water cycle" })[0].version, 2);
  assert.equal(
    m.publishedResources(state, { q: "water cycle" })[0].filename,
    "unapproved.pptx",
  );
  m.archive(state, r.id, "leon", true);
  assert.equal(m.publishedResources(state, { q: "water cycle" }).length, 0);
  m.archive(state, r.id, "leon", false);
  assert.equal(m.publishedResources(state, { q: "water cycle" })[0].version, 2);
});
