import type { Person, Resource, ResourceState } from "./types";
export const areas = [
  "Araling Panlipunan",
  "English",
  "Filipino",
  "Mathematics",
  "Science",
  "Technology and Livelihood Education",
  "Music and Arts",
  "Physical Education and Health",
  "Values Education",
];
export const grades = [7, 8, 9, 10].map((n) => `Grade ${n}`);
// School-calendar terms (DepEd Order No. 009, s. 2026), as the Project SIKAP
// proposal schedules the school year. Older resources may still read
// "Quarter 1-4"; they display as saved and are relabeled when edited.
export const terms = [1, 2, 3].map((n) => `Term ${n}`);
export const PPTX_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const fileAccept = ".pdf,.docx";
export const fileHint = "PDF or DOCX · up to 20 MB";
export const categories = {
  METHODS: "Teaching Methods",
  MODELS: "Strategic Innovations",
  UNITS: "Media Materials",
};
// One line each, so a teacher knows at once where a file belongs.
export const categoryHelp: Record<string, string> = {
  METHODS: "How to teach it: approaches, routines and techniques.",
  MODELS: "Lesson plans and frameworks built around a new idea.",
  UNITS: "Ready-to-use materials: worksheets, slides and readings.",
};
// LRMDS descriptors recorded for every new resource.
export const resourceTypes = [
  "Lesson plan",
  "Activity sheet or worksheet",
  "Slide deck",
  "Assessment",
  "Reading material",
  "Other",
];
export const languages = [
  "English",
  "Filipino",
  "English and Filipino",
  "Other",
];
export const usageRights = [
  "Original work",
  "Adapted from a source",
  "Used with permission",
];
export const criteria = {
  objectives: "Learning objectives",
  content: "Content accuracy",
  activities: "Learning activities",
  assessment: "Assessment and answer key",
};
export const statusLabels: Record<ResourceState, string> = {
  draft: "Draft",
  pending: "Pending review",
  resubmitted: "Resubmitted",
  returned: "Returned for revision",
  approved: "Approved",
  rejected: "Not accepted",
  archived: "Archived",
};
export function resourceState(r: Resource): ResourceState {
  return r.archived
    ? "archived"
    : r.bank_draft
      ? "draft"
      : r.state ||
        (r.status === "pending" && r.version > 1 ? "resubmitted" : r.status);
}
export function submitted(rows: Resource[]) {
  return rows.filter((r) => !["draft", "archived"].includes(resourceState(r)));
}
export function summary(rows: Resource[], people: Person[]) {
  const teachers = new Map(
    people
      .filter((p) => p.role === "teacher" && p.approval_status === "approved")
      .map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          submitted: 0,
          approved: 0,
          pending: 0,
          returned: 0,
        },
      ]),
  );
  const byArea = new Map(areas.map((name) => [name, 0]));
  for (const r of submitted(rows)) {
    if (!teachers.has(r.owner))
      teachers.set(r.owner, {
        id: r.owner,
        name: r.creator,
        submitted: 0,
        approved: 0,
        pending: 0,
        returned: 0,
      });
    const teacher = teachers.get(r.owner)!;
    teacher.submitted++;
    const status = resourceState(r);
    if (status === "pending" || status === "resubmitted") teacher.pending++;
    if (status === "approved") teacher.approved++;
    if (status === "returned") teacher.returned++;
    if (!byArea.has(r.subject)) byArea.set(r.subject, 0);
    if (status === "approved")
      byArea.set(r.subject, byArea.get(r.subject)! + 1);
  }
  return {
    teachers: [...teachers.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    areas: [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}
export function date(value?: string) {
  return value
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value,
      ).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}
export function checkMetadata(d: Record<string, unknown>) {
  if (
    !areas.includes(String(d.subject)) ||
    !grades.includes(String(d.grade)) ||
    !terms.includes(String(d.term)) ||
    !Object.hasOwn(categories, String(d.category))
  )
    throw Error("Choose a listed category, learning area, grade and term.");
  if (
    !resourceTypes.includes(String(d.resource_type)) ||
    !languages.includes(String(d.language)) ||
    !usageRights.includes(String(d.rights))
  )
    throw Error("Choose the resource type, language and usage rights.");
  if (!String(d.competency || "").trim())
    throw Error("Enter or choose the learning competency.");
  if (!Array.isArray(d.tags) || !d.tags.length || d.tags.length > 20)
    throw Error("Enter 1 to 20 comma-separated tags.");
}
