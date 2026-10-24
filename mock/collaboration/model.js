export const people = [
  {
    id: "tom",
    name: "Tom Jerald Ferrer",
    role: "teacher",
    department: "Science",
  },
  { id: "mara", name: "Mara Santos", role: "teacher", department: "Science" },
  {
    id: "jose",
    name: "Jose Reyes",
    role: "teacher",
    department: "Mathematics",
  },
  {
    id: "leon",
    name: "Leon Laborina",
    role: "head",
    department: "Head Teacher",
  },
];
export const limits = {
  documentMB: 20,
  videoMB: 100,
  videoMinutes: 10,
  audioMB: 25,
  audioMinutes: 20,
};
const clone = (value) => structuredClone(value);
const person = (id) => people.find((p) => p.id === id);
export const nameOf = (id) => person(id)?.name || "Teacher";
export const member = (r, id) =>
  r.owner === id ||
  r.contributors.some((c) => c.id === id && c.status === "accepted");
export function canEdit(r, id) {
  return !r.archived && !!r.working && member(r, id);
}
export function canSee(r, id) {
  return (
    !!r.published ||
    member(r, id) ||
    (person(id)?.role === "head" && r.status !== "draft")
  );
}
const sampleDeck = () => ({
  name: "water-cycle-localized.pptx",
  type: "pptx",
  bytes: 24576,
  url: "mock-assets/water-cycle.pptx",
  preview: {
    name: "water-cycle-review.pdf",
    url: "mock-assets/water-cycle.pdf",
    bytes: 2400,
  },
  transcript: "",
  permission: true,
  sample: true,
});
const base = (id, title, category, subject, owner) => ({
  id,
  title,
  category,
  subject,
  grade: "Grade 7",
  quarter: "Quarter 2",
  description:
    "A contextualized learning resource prepared with examples from the school community.",
  localization:
    "Connect the lesson to farms, households and everyday experiences in Nueva Ecija.",
  competency:
    "Use the school's verified curriculum competency when creating the final resource.",
  owner,
  contributors: [],
  comments: [],
  proposals: [],
  versions: [],
  published: null,
  reviewVersion: null,
  status: "draft",
  archived: false,
  working: null,
  activity: [],
});
function seedVersion(r, attachment) {
  r.versions.push({
    number: 1,
    title: r.title,
    attachment,
    contributors: [r.owner],
    submittedBy: r.owner,
    submittedAt: "2026-10-23T09:00:00Z",
    status: "approved",
    feedback: "Ready for classroom use.",
    reviewer: "leon",
  });
  r.status = "approved";
  r.published = 1;
}
export function initialState() {
  const deck = base(
    "water-cycle",
    "Water cycle through local farming",
    "UNITS",
    "Science",
    "tom",
  );
  deck.contributors = [{ id: "mara", status: "accepted" }];
  deck.working = {
    attachment: sampleDeck(),
    notes: "Initial shared draft",
    selectedProposal: null,
  };
  deck.comments = [
    {
      id: "c1",
      author: "mara",
      body: "I added rice-field examples to the discussion prompts. Could we include a short assessment?",
      at: "2026-10-23T10:00:00Z",
    },
  ];
  deck.proposals = [
    {
      id: "p1",
      author: "mara",
      notes:
        "Added three assessment questions and a local rainfall example. The PPTX and PDF review copy are included together.",
      attachment: sampleDeck(),
      at: "2026-10-23T10:15:00Z",
      selected: false,
    },
  ];
  const video = base(
    "plant-video",
    "Observing plants in the school garden",
    "METHODS",
    "Science",
    "tom",
  );
  seedVersion(video, {
    name: "sample-flower.mp4",
    type: "mp4",
    bytes: 1128375,
    duration: 5,
    url: "https://developer.mozilla.org/shared-assets/videos/flower.mp4",
    transcript:
      "Sample clip: a bee approaches a flower. Use your own instructional video to test a complete lesson.",
    permission: true,
    sample: true,
  });
  video.contributors = [{ id: "jose", status: "invited" }];
  const audio = base(
    "oral-audio",
    "Listening activity with sound recordings",
    "MODELS",
    "English",
    "mara",
  );
  seedVersion(audio, {
    name: "sample-sound.mp3",
    type: "mp3",
    bytes: 15000,
    duration: 2,
    url: "https://developer.mozilla.org/shared-assets/audio/t-rex-roar.mp3",
    transcript:
      "Sample sound effect for testing the audio player. Replace it with a teacher-created listening activity.",
    permission: true,
    sample: true,
  });
  const pending = base(
    "assessment-slides",
    "Community market mathematics",
    "UNITS",
    "Mathematics",
    "jose",
  );
  pending.contributors = [{ id: "tom", status: "accepted" }];
  pending.working = {
    attachment: sampleDeck(),
    notes: "Initial submission",
    selectedProposal: null,
  };
  const state = { resources: [deck, video, audio, pending] };
  submit(state, "assessment-slides", "jose");
  return state;
}
export function resource(state, id) {
  const r = state.resources.find((x) => x.id === id);
  if (!r) throw Error("Resource not found.");
  return r;
}
function owner(r, actor) {
  if (r.owner !== actor) throw Error("Only the resource owner can do this.");
}
function editable(r, actor) {
  if (!canEdit(r, actor))
    throw Error(
      "This submitted version is locked. Work can resume in a new or returned draft.",
    );
}
function log(r, actor, body) {
  r.activity.unshift({ actor, body, at: new Date().toISOString() });
}
function validPackage(attachment) {
  if (!attachment) throw Error("Attach a resource file before submitting.");
  if (attachment.type === "pptx" && !attachment.preview)
    throw Error("A PPTX needs its PDF review copy in the same package.");
  if (["mp4", "mp3"].includes(attachment.type) && !attachment.permission)
    throw Error("Confirm that you have permission to share this recording.");
}
export function createResource(state, actor, fields, attachment) {
  if (person(actor)?.role !== "teacher")
    throw Error("Switch to a Teacher account to create a resource.");
  for (const key of [
    "title",
    "category",
    "subject",
    "grade",
    "quarter",
    "description",
    "localization",
    "competency",
  ])
    if (!String(fields[key] || "").trim())
      throw Error("Complete every required resource field.");
  validPackage(attachment);
  const r = {
    ...base(
      crypto.randomUUID(),
      fields.title.trim(),
      fields.category,
      fields.subject.trim(),
      actor,
    ),
    ...fields,
    owner: actor,
  };
  r.working = {
    attachment: clone(attachment),
    notes: "Initial draft",
    selectedProposal: null,
  };
  state.resources.unshift(r);
  log(r, actor, "Created a draft");
  return r;
}
export function invite(state, id, actor, target) {
  const r = resource(state, id);
  owner(r, actor);
  editable(r, actor);
  if (!person(target) || person(target).role !== "teacher" || target === actor)
    throw Error("Choose another Teacher.");
  if (r.contributors.some((c) => c.id === target && c.status !== "declined"))
    throw Error("This Teacher is already a contributor or has an invitation.");
  r.contributors = r.contributors.filter((c) => c.id !== target);
  r.contributors.push({ id: target, status: "invited" });
  log(r, actor, `Invited ${nameOf(target)}`);
}
export function answerInvite(state, id, actor, accept) {
  const r = resource(state, id),
    invitation = r.contributors.find(
      (c) => c.id === actor && c.status === "invited",
    );
  if (!invitation) throw Error("This invitation is no longer available.");
  invitation.status = accept ? "accepted" : "declined";
  log(r, actor, accept ? "Accepted the invitation" : "Declined the invitation");
}
export function comment(state, id, actor, body) {
  const r = resource(state, id);
  editable(r, actor);
  if (!body.trim() || body.length > 3000)
    throw Error("Write a comment of up to 3,000 characters.");
  r.comments.push({
    id: crypto.randomUUID(),
    author: actor,
    body: body.trim(),
    at: new Date().toISOString(),
  });
}
export function propose(state, id, actor, notes, attachment = null) {
  const r = resource(state, id);
  editable(r, actor);
  if (r.owner === actor)
    throw Error("The owner can update the working files directly.");
  if (!notes.trim() || notes.length > 3000)
    throw Error("Describe your proposed changes in up to 3,000 characters.");
  if (attachment) validPackage(attachment);
  r.proposals.push({
    id: crypto.randomUUID(),
    author: actor,
    notes: notes.trim(),
    attachment: clone(attachment),
    at: new Date().toISOString(),
    selected: false,
  });
  log(r, actor, "Proposed a revision");
}
export function selectProposal(state, id, actor, proposalId) {
  const r = resource(state, id);
  owner(r, actor);
  editable(r, actor);
  const p = r.proposals.find((x) => x.id === proposalId);
  if (!p || !p.attachment)
    throw Error(
      "This proposal has no replacement files. Apply its suggestions manually.",
    );
  r.proposals.forEach((x) => (x.selected = x.id === proposalId));
  r.working = {
    attachment: clone(p.attachment),
    notes: p.notes,
    selectedProposal: proposalId,
  };
  log(r, actor, `Selected ${nameOf(p.author)}'s proposed files`);
}
export function updateDraft(state, id, actor, attachment, notes) {
  const r = resource(state, id);
  owner(r, actor);
  editable(r, actor);
  validPackage(attachment);
  r.working = {
    attachment: clone(attachment),
    notes: notes.trim() || "Updated draft files",
    selectedProposal: null,
  };
  r.proposals.forEach((p) => (p.selected = false));
  log(r, actor, "Updated the working files");
}
export function submit(state, id, actor) {
  const r = resource(state, id);
  owner(r, actor);
  editable(r, actor);
  validPackage(r.working.attachment);
  const version = {
    number: r.versions.length + 1,
    title: r.title,
    attachment: clone(r.working.attachment),
    contributors: [
      r.owner,
      ...r.contributors.filter((c) => c.status === "accepted").map((c) => c.id),
    ],
    submittedBy: actor,
    submittedAt: new Date().toISOString(),
    changes: r.working.notes,
    status: "pending",
    reviewer: null,
    feedback: "",
  };
  r.versions.push(version);
  r.reviewVersion = version.number;
  r.status = "pending";
  r.working = null;
  log(r, actor, `Submitted version ${version.number} for review`);
  return version;
}
export function review(state, id, actor, decision, checks, feedback) {
  const r = resource(state, id);
  if (
    person(actor)?.role !== "head" ||
    actor === r.owner ||
    r.status !== "pending" ||
    r.archived
  )
    throw Error("Only a Head Teacher can review a pending submission.");
  const required = ["objectives", "content", "activities", "assessment"];
  if (!required.every((key) => ["met", "revise"].includes(checks[key])))
    throw Error("Complete the existing four-item review checklist.");
  if (!["approved", "returned"].includes(decision))
    throw Error("Choose approve or return.");
  const revisions = required.some((key) => checks[key] === "revise");
  if (decision === "approved" && revisions)
    throw Error("Resolve all checklist items before approval.");
  if (decision === "returned" && (!revisions || !feedback.trim()))
    throw Error(
      "Mark an item for revision and write feedback before returning.",
    );
  const v = r.versions.find((x) => x.number === r.reviewVersion);
  v.status = decision;
  v.reviewer = actor;
  v.feedback = feedback.trim();
  v.checks = clone(checks);
  r.status = decision;
  if (decision === "approved") r.published = v.number;
  else
    r.working = {
      attachment: clone(v.attachment),
      notes: "Revision following review feedback",
      selectedProposal: null,
    };
  log(
    r,
    actor,
    `${decision === "approved" ? "Approved" : "Returned"} version ${v.number}`,
  );
}
export function startRevision(state, id, actor) {
  const r = resource(state, id);
  owner(r, actor);
  if (r.archived || r.status !== "approved" || r.working)
    throw Error(
      "A new draft can start after approval, when no draft is already open.",
    );
  const approved = r.versions.find((v) => v.number === r.published);
  r.working = {
    attachment: clone(approved.attachment),
    notes: "New revision",
    selectedProposal: null,
  };
  r.proposals = [];
  log(r, actor, "Started a new revision; the approved version is preserved");
}
export function archive(state, id, actor, value) {
  const r = resource(state, id);
  if (person(actor)?.role !== "head" || r.status === "draft")
    throw Error(
      "Only a Head Teacher can archive or restore submitted resources.",
    );
  r.archived = !!value;
  log(r, actor, value ? "Archived the resource" : "Restored the resource");
}

// Read only the frozen approved snapshot; a newer draft never replaces it.
export function publishedResources(state, filters = {}) {
  return state.resources
    .filter((r) => r.published && !r.archived)
    .map((r) => {
      const v = r.versions.find((v) => v.number === r.published);
      return {
        id: r.id,
        title: v.title,
        category: r.category,
        subject: r.subject,
        grade: r.grade,
        term: r.quarter,
        version: v.number,
        filename: v.attachment?.name || "",
        type: v.attachment?.type,
        credits: v.contributors.map(nameOf),
        creator: r.owner,
        updated: v.submittedAt,
      };
    })
    .filter(
      (r) =>
        ["category", "subject", "grade", "term", "creator"].every(
          (k) => !filters[k] || r[k] === filters[k],
        ) &&
        (!filters.status || filters.status === "approved") &&
        (!filters.type ||
          {
            pdf: "application/pdf",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            mp4: "video/mp4",
            mp3: "audio/mpeg",
          }[r.type] === filters.type) &&
        (!filters.q ||
          [r.title, r.subject, r.filename, ...r.credits]
            .join(" ")
            .toLowerCase()
            .includes(filters.q.toLowerCase())) &&
        (!filters.date || r.updated.slice(0, 10) >= filters.date),
    )
    .sort((a, b) =>
      filters.sort === "name"
        ? a.title.localeCompare(b.title)
        : filters.sort === "oldest"
          ? a.updated.localeCompare(b.updated)
          : b.updated.localeCompare(a.updated),
    );
}
