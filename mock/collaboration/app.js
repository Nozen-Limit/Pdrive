import * as m from "./model.js";
import { readPackage, fileType } from "./files.js";
import { documentXml } from "../../src/lib/docx.js";

let state = m.initialState(),
  actor = "tom",
  scope = "drafts",
  selected = null,
  versionView = null,
  query = "",
  category = "",
  formBusy = false;
const objectUrls = new Set();
let embedded = false;
window.sikapCollaboration = {
  published(filters) {
    return m.publishedResources(state, filters);
  },
  open(id, published = false) {
    const r = state.resources.find((r) => r.id === id);
    if (!r || (published && (!r.published || r.archived))) return;
    selected = id;
    scope = published ? "bank" : "drafts";
    versionView = published ? r.published : null;
    render();
  },
  mount(role) {
    embedded = true;
    actor = role === "head" ? "leon" : "tom";
    render();
  },
};
const activePreview = () =>
  !embedded || !!document.querySelector("#bank-collaboration-preview");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<span class="material-symbols-rounded" aria-hidden="true">${name}</span>`;
const action = (name, text, attrs = "", style = "bank-text-button") =>
  `<button type="button" class="${style}" data-action="${name}" ${attrs}>${text}</button>`;
const current = () => m.people.find((p) => p.id === actor);
const head = () => current().role === "head";
const initials = (name) =>
  name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const bytes = (n) =>
  n >= 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : Math.max(1, Math.ceil(n / 1024)) + " KB";
const duration = (n) =>
  `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
const label = (r) =>
  r.archived
    ? "Archived"
    : r.working && r.published
      ? "Draft revision"
      : {
          draft: "Shared draft",
          pending: "Pending review",
          returned: "Returned for revision",
          approved: "Approved",
        }[r.status];
const badge = (r) =>
  `<span class="bank-status bank-status-${r.archived ? "archived" : r.working && r.published ? "draft" : r.status}">${label(r)}</span>`;
const personRow = (id, note, extra = "") =>
  `<div class="collab-person"><span class="avatar">${esc(initials(m.nameOf(id)))}</span><span><strong>${esc(m.nameOf(id))}</strong><small>${esc(note)}</small></span>${extra}</div>`;
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 4000);
}
function registerUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.add(url);
  return url;
}
function navigation() {
  const invites = state.resources.filter((r) =>
    r.contributors.some((c) => c.id === actor && c.status === "invited"),
  ).length;
  const item = (key, i, title, count = 0) =>
    action(
      "navigate",
      `${icon(i)}<span>${title}</span>${count ? `<span class="nav-count">${count}</span>` : ""}`,
      `data-scope="${key}"`,
      scope === key && !selected ? "active" : "",
    );
  return `<div class="bank-new">${action("new", `${icon("add")}New resource`, "", "secondary")}</div><nav aria-label="Digital Bank">${item("overview", "dashboard", "Overview")}${item("bank", "database", "Digital Bank")}${!head() ? item("mine", "folder_open", "My resources") + item("drafts", "group_work", "Shared drafts") + item("invitations", "mail", "Invitations", invites) : item("review", "fact_check", "Resource reviews") + item("archived", "archive", "Archived resources")}<span class="bank-nav-label">Resource bank</span>${["METHODS", "MODELS", "UNITS"].map((c) => action("category", `${icon("folder")}<span>${c[0] + c.slice(1).toLowerCase()}</span>`, `data-category="${c}"`)).join("")}<span class="bank-nav-label">Preview</span>${action("limits", `${icon("tune")}<span>File limits</span>`)}</nav>`;
}
function render() {
  const title = selected
    ? "Resource details"
    : {
        overview: "Overview",
        bank: "Digital Bank",
        mine: "My resources",
        drafts: "Shared drafts",
        invitations: "Invitations",
        review: "Resource reviews",
        archived: "Archived resources",
      }[scope];
  if (embedded) {
    const root = document.querySelector("#bank-collaboration-preview");
    if (!root) return;
    root.innerHTML = `<div class="mock-banner"><span><strong>Local preview</strong> · Sample resources. Changes reset on reload.</span>${action("reset", "Reset sample data")}</div><div class="collab-detail-toolbar"><label class="mock-role">Preview as<select id="preview-person" aria-label="Preview as">${m.people.map((p) => `<option value="${p.id}" ${p.id === actor ? "selected" : ""}>${esc(p.name)} · ${p.role === "head" ? "Head Teacher" : "Teacher"}</option>`).join("")}</select></label>${action("new", icon("add") + "New resource", "", "secondary")}${action("navigate", "Shared drafts", 'data-scope="drafts"')}${action("navigate", "Invitations", 'data-scope="invitations"')}${head() ? action("navigate", "Review queue", 'data-scope="review"') : ""}${action("limits", "File limits")}</div><h1>${title}</h1>${selected ? detail() : scope === "invitations" ? invitations() : scope === "overview" ? overview() : listing()}<dialog id="mock-dialog" class="collab-dialog" aria-labelledby="dialog-title"></dialog>`;
  } else {
    document.querySelector("#app").innerHTML =
      `<div class="app bank-app workspace-app" style="--sikap-bg:#fcfcfd;--sikap-accent:#456958;--sikap-action:#34475f;--ink:#24272c;--muted:#737980;--line:#e7e9ec;--bank-side:#f7f8f9"><aside class="sidebar workspace-sidebar bank-sidebar"><div class="workspace-brand"><span class="brand-symbol">${icon("auto_stories")}</span><div class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></div></div>${action("menu", "Close navigation", 'aria-label="Close navigation"', "secondary mock-menu")} ${navigation()}<div class="mock-account">${personRow(actor, current().role === "head" ? "Head Teacher · sample account" : "Teacher · sample account")}</div></aside><button class="mock-nav-scrim" data-action="menu" aria-label="Dismiss navigation"></button><main class="main bank-main"><header class="topbar bank-topbar"><div class="page-heading">${action("menu", icon("menu"), 'aria-label="Open navigation"', "icon-btn mock-menu")}<h1>${title}</h1></div><div class="top-actions"><label class="mock-role"><span>Preview as</span><select id="preview-person" aria-label="Preview as">${m.people.map((p) => `<option value="${p.id}" ${p.id === actor ? "selected" : ""}>${esc(p.name)} · ${p.role === "head" ? "Head Teacher" : "Teacher"}</option>`).join("")}</select></label></div></header><section class="content bank-content">${selected ? detail() : scope === "invitations" ? invitations() : scope === "overview" ? overview() : listing()}</section></main></div>`;
  }
  hydrateDocx();
  hydratePdf();
}
function visibleRows() {
  return state.resources
    .filter((r) => {
      if (!m.canSee(r, actor)) return false;
      if (scope === "archived") return head() && r.archived;
      if (r.archived) return false;
      if (scope === "bank" || scope === "overview") return !!r.published;
      if (scope === "mine") return r.owner === actor;
      if (scope === "drafts") return !!r.working && m.member(r, actor);
      if (scope === "review") return head() && r.status === "pending";
      return false;
    })
    .filter(
      (r) =>
        (!category || r.category === category) &&
        `${r.title} ${r.subject} ${m.nameOf(r.owner)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
}
function listing() {
  const rows = visibleRows();
  return `<nav class="bank-workspace-tabs" aria-label="Resource collections">${action("navigate", `${icon("database")}Digital Bank`, 'data-scope="bank"')}${!head() ? action("navigate", `${icon("group_work")}Shared drafts`, 'data-scope="drafts"') + action("navigate", `${icon("folder_open")}My resources`, 'data-scope="mine"') : action("navigate", `${icon("fact_check")}Review queue`, 'data-scope="review"')}</nav><div class="overview-toolbar"><div class="overview-search">${icon("search")}<input id="mock-search" type="search" aria-label="Search resources" placeholder="Search resources" value="${esc(query)}"></div><span class="collab-meta-note">${rows.length} resource${rows.length === 1 ? "" : "s"}${category ? " · " + category : ""}</span>${category ? action("clear-filter", "Clear filter") : ""}</div><div id="mock-table">${table(rows)}</div>${scope === "drafts" ? '<p class="collab-meta-note">Accepted contributors can comment and propose files. The owner selects the final package and submits it for review.</p>' : scope === "bank" ? '<p class="collab-meta-note">Only approved versions appear here. Working drafts and pending revisions remain separate.</p>' : ""}`;
}
function table(rows) {
  if (!rows.length)
    return `<div class="collab-empty">${scope === "drafts" ? "No shared drafts yet. Create a resource or accept an invitation." : scope === "archived" ? "No archived resources." : "No resources match this view."}</div>`;
  return `<div class="collab-table-wrap"><table class="collab-table"><thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Learning area</th><th scope="col">Contributors</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>${rows
    .map((r) => {
      const published = r.versions.find((v) => v.number === r.published),
        publicView = scope === "bank";
      const file = publicView
        ? published?.attachment
        : r.working?.attachment || r.versions.at(-1)?.attachment;
      const credits = publicView
        ? published?.contributors || [r.owner]
        : [
            r.owner,
            ...r.contributors
              .filter((c) => c.status === "accepted")
              .map((c) => c.id),
          ];
      return `<tr><td>${action("open", esc(r.title), `data-id="${r.id}"`)}<small>${file ? file.type.toUpperCase() : "No file"} · ${esc(r.grade)} · ${esc(r.quarter)}</small></td><td data-label="Category">${r.category}</td><td data-label="Learning area">${esc(r.subject)}</td><td data-label="Contributors">${credits.map(m.nameOf).map(esc).join("<br>")}</td><td data-label="Status">${publicView ? '<span class="bank-status bank-status-approved">Approved</span>' : badge(r)}</td><td>${action("open", "Open", `data-id="${r.id}"`)}${head() && scope === "archived" ? action("restore", "Restore", `data-id="${r.id}"`) : ""}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function overview() {
  const rows = state.resources.filter(
    (r) =>
      !r.archived &&
      m.canSee(r, actor) &&
      (head() ? r.status !== "draft" : r.owner === actor),
  );
  return `<nav class="bank-workspace-tabs">${action("navigate", `${icon("folder_open")}All resources`, 'data-scope="mine"')}${head() ? action("navigate", `${icon("fact_check")}Pending review`, 'data-scope="review"') : action("navigate", `${icon("group_work")}Shared drafts`, 'data-scope="drafts"')}</nav><div class="bank-board overview-board">${[
    ["draft", "Drafts", "edit_note"],
    ["pending", "Pending review", "schedule"],
    ["approved", "Approved", "check_circle"],
  ]
    .map(
      ([status, title, i]) =>
        `<section class="bank-board-column"><header><span class="bank-board-state bank-board-state-${status}">${icon(i)}</span><h2>${title}</h2><span class="bank-board-count">${rows.filter((r) => r.status === status).length}</span></header><div class="bank-board-stack">${
          rows
            .filter((r) => r.status === status)
            .map(
              (r) =>
                `<article class="bank-board-card"><div class="bank-board-card-top"><span>${r.category}</span><span>${esc(initials(m.nameOf(r.owner)))}</span></div><div class="bank-board-card-title">${icon(i)}${action("open", esc(r.title), `data-id="${r.id}"`)}</div><div class="bank-board-card-bottom"><span class="bank-board-label">${esc(r.subject)}</span><span class="bank-board-label">${esc(r.grade)}</span></div></article>`,
            )
            .join("") || '<div class="bank-board-empty">No resources</div>'
        }</div></section>`,
    )
    .join("")}</div>`;
}
function invitations() {
  const rows = state.resources.filter((r) =>
    r.contributors.some((c) => c.id === actor && c.status === "invited"),
  );
  return `<h2 class="bank-page-heading">Contributor invitations</h2><p class="collab-meta-note">Accept to join the shared draft. Declining leaves the draft private.</p>${rows.map((r) => `<section class="collab-invite"><h2>${esc(r.title)}</h2><p class="collab-meta-note">${esc(m.nameOf(r.owner))} invited you to contribute · ${esc(r.subject)} · ${esc(r.grade)}</p><div class="collab-inline">${action("accept", "Accept invitation", `data-id="${r.id}"`, "primary")}${action("decline", "Decline", `data-id="${r.id}"`, "secondary")}</div></section>`).join("") || '<p class="collab-empty">No pending invitations for this account.</p>'}`;
}
function detail() {
  const r = m.resource(state, selected);
  if (!m.canSee(r, actor))
    return '<p class="collab-empty">Accept your invitation before viewing this shared draft.</p>';
  const privateView = m.member(r, actor) || head();
  const snapshot =
    privateView && versionView
      ? r.versions.find((v) => v.number === versionView)
      : !privateView || scope === "bank"
        ? r.versions.find((v) => v.number === r.published)
        : m.member(r, actor) && r.working
          ? null
          : r.versions.at(-1);
  const working = !snapshot && !!r.working && m.member(r, actor);
  const attachment = working ? r.working.attachment : snapshot?.attachment;
  const editable = working && m.canEdit(r, actor),
    own = r.owner === actor;
  const credits = snapshot?.contributors || [
    r.owner,
    ...r.contributors.filter((c) => c.status === "accepted").map((c) => c.id),
  ];
  return `<div class="bank-detail-heading">${action("back", `${icon("arrow_back")}Back to resources`)}<div><h1>${esc(snapshot?.title || r.title)}</h1>${snapshot ? `<span class="bank-status bank-status-${snapshot.status}">Version ${snapshot.number} · ${{ pending: "Pending review", approved: "Approved", returned: "Returned" }[snapshot.status]}</span>` : badge(r)}</div><p>Digital Bank / ${r.category} / ${esc(r.subject)}</p><div class="collab-detail-toolbar">${editable && own ? action("files", `${icon("upload_file")}Update draft files`, "", "secondary") + action("invite", `${icon("person_add")}Invite contributor`, "", "secondary") + action("submit", `${icon("send")}Submit for review`, "", "primary") : editable ? action("propose", `${icon("upload_file")}Propose a revision`, "", "primary") : ""}${own && r.status === "approved" && !r.working && !r.archived ? action("revision", `${icon("edit_note")}Start new revision`, "", "secondary") : ""}${privateView && r.working && snapshot ? action("working", "Open working draft", "", "secondary") : ""}${privateView && r.published && (!snapshot || snapshot.number !== r.published) ? action("published", "View approved version", "", "secondary") : ""}${head() && r.status !== "draft" ? action(r.archived ? "restore" : "archive", icon(r.archived ? "unarchive" : "archive") + (r.archived ? "Restore resource" : "Archive resource"), `data-id="${r.id}"`, "secondary") : ""}</div></div>${snapshot && snapshot.status === "pending" ? `<p class="collab-lock">${icon("lock")}Submitted version ${snapshot.number} is locked. Contributor files, comments and new invitations cannot change this submission.</p>` : ""}${r.published && r.working && working ? `<p class="collab-lock">${icon("history")}Approved version ${r.published} remains available in the Digital Bank while this revision is prepared.</p>` : ""}<div class="bank-review-workspace"><div class="bank-document"><section><h2>Description</h2><p class="bank-prose">${esc(r.description)}</p><h2>Contextualization / Localization</h2><p class="bank-prose">${esc(r.localization)}</p></section><section class="collab-section"><h2>${attachment?.type === "pptx" ? "Slide deck and PDF review copy" : "Resource preview"}</h2>${filePreview(attachment)}</section>${privateView ? proposals(r, editable, own) + comments(r, editable) + history(r) : ""}</div><aside class="bank-metadata"><h2>Resource details</h2><dl>${[
    ["Category", r.category],
    ["Learning area", r.subject],
    ["Grade", r.grade],
    ["Quarter", r.quarter],
    ["Owner", m.nameOf(r.owner)],
  ]
    .map(([key, value]) => `<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`)
    .join(
      "",
    )}</dl><h3>Contributors</h3>${credits.map((id) => personRow(id, id === r.owner ? "Owner · submits the final version" : "Contributor")).join("")}${
    working && own
      ? r.contributors
          .filter((c) => c.status === "invited")
          .map((c) => personRow(c.id, "Invitation pending"))
          .join("")
      : ""
  }<h3>Learning competency</h3><p class="bank-prose">${esc(r.competency)}</p>${head() && r.status === "pending" && snapshot?.number === r.reviewVersion && !r.archived ? reviewForm() : ""}${snapshot?.feedback ? `<h3>Review feedback</h3><p class="bank-prose">${esc(snapshot.feedback)}</p>` : ""}</aside></div>`;
}
function fileRow(file, note, type = null) {
  if (!file) return "";
  return `<div class="collab-file">${icon(type === "pdf" ? "picture_as_pdf" : "attach_file")}<span><strong>${esc(file.name)}</strong><small>${esc(note)} · ${bytes(file.bytes || 0)}</small></span><a href="${esc(file.url)}" ${file.url?.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : `download="${esc(file.name)}"`}>${file.url?.startsWith("http") ? "Open sample" : "Download"}</a></div>`;
}
function filePreview(file) {
  if (!file)
    return '<p class="collab-meta-note">Attach a file to this draft.</p>';
  const main = fileRow(
    file,
    file.type.toUpperCase() +
      (file.duration ? " · " + duration(file.duration) : ""),
  );
  const sample = file.sample
    ? `<p class="collab-meta-note">Sample ${["mp3", "mp4"].includes(file.type) ? 'playback file from <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/' + (file.type === "mp4" ? "video" : "audio") + '" target="_blank" rel="noopener noreferrer">MDN</a>' : "slide package"}. Upload your own file to try a real resource. Uploaded files stay in this tab.</p>`
    : "";
  let preview = "";
  if (file.type === "pptx")
    preview =
      fileRow(file.preview, "PDF review copy · paired with this PPTX", "pdf") +
      `<p class="collab-meta-note">These two files are submitted and approved as one version. The PDF is the review copy; download the PPTX to adapt the slides.</p>${pdfPreview(file.preview.url)}`;
  else if (file.type === "pdf") preview = pdfPreview(file.url);
  else if (file.type === "docx")
    preview = `<div id="mock-docx" data-url="${esc(file.url)}" class="bank-prose">Loading document text…</div>`;
  else if (file.type === "mp4")
    preview = `<video class="collab-media" controls preload="metadata" playsinline aria-label="Instructional video" src="${esc(file.url)}">${file.caption ? `<track kind="captions" src="${esc(file.caption.url)}" srclang="en" label="Uploaded captions" default>` : ""}Your browser cannot play this file. Use the download link.</video>`;
  else
    preview = `<audio class="collab-media" controls preload="metadata" aria-label="Instructional audio" src="${esc(file.url)}">Your browser cannot play this file. Use the download link.</audio>`;
  return (
    main +
    sample +
    preview +
    (file.transcript
      ? `<details class="collab-transcript"><summary>Transcript</summary><p>${esc(file.transcript)}</p></details>`
      : ["mp4", "mp3"].includes(file.type)
        ? '<p class="collab-meta-note">No transcript has been added.</p>'
        : "") +
    (["mp4", "mp3"].includes(file.type)
      ? '<p class="collab-meta-note">Download the original recording to play it offline. The website itself still needs a connection.</p>'
      : "")
  );
}
function proposals(r, editable, own) {
  return `<section class="collab-section"><h2>Proposed revisions</h2>${r.proposals.map((p) => `<article class="bank-history-entry"><strong>${esc(m.nameOf(p.author))}</strong><small>${date(p.at)}${p.selected ? " · Selected for the working draft" : " · Proposed"}</small><p class="bank-prose">${esc(p.notes)}</p>${p.attachment ? `<p class="collab-meta-note">${esc(p.attachment.name)}${p.attachment.preview ? " + " + esc(p.attachment.preview.name) : ""}</p>` : ""}${editable && own && p.attachment ? action("select-proposal", p.selected ? "Selected" : "Use these files", `data-proposal="${p.id}" ${p.selected ? "disabled" : ""}`, "secondary") : ""}</article>`).join("") || '<p class="collab-meta-note">No proposed revisions yet.</p>'}${editable && !own ? action("propose", "Propose a revision", "", "secondary") : ""}</section>`;
}
function comments(r, editable) {
  return `<section class="collab-section"><h2>Draft discussion</h2>${r.comments.map((c) => `<article class="collab-comment"><strong>${esc(m.nameOf(c.author))}</strong><small>${date(c.at)}</small><p>${esc(c.body)}</p></article>`).join("") || '<p class="collab-meta-note">Discuss local examples, assessment questions or changes to the resource.</p>'}${editable ? '<form id="comment-form"><label class="bank-form-field">Comment<textarea name="body" maxlength="3000" required placeholder="Suggest a change or leave a note for your collaborators"></textarea></label><p class="form-error" role="alert"></p><button class="secondary" type="submit">Post comment</button></form>' : '<p class="collab-meta-note">This version is read-only. The owner can start or reopen a draft to continue.</p>'}</section>`;
}
function history(r) {
  return `<section class="collab-section"><h2>Version history</h2>${
    [...r.versions]
      .reverse()
      .map(
        (v) =>
          `<div class="bank-history-entry"><strong>Version ${v.number} · ${{ pending: "Pending review", approved: "Approved", returned: "Returned" }[v.status]}</strong><small>Submitted by ${esc(m.nameOf(v.submittedBy))} · ${date(v.submittedAt)}</small><p class="collab-meta-note">Credits: ${v.contributors.map(m.nameOf).map(esc).join(", ")}</p><p class="bank-prose">${esc(v.changes || "Initial resource")}</p>${action("version", "View this version", `data-version="${v.number}"`)}</div>`,
      )
      .join("") ||
    '<p class="collab-meta-note">No submitted versions. The first submission will create version 1.</p>'
  }<h2>Activity</h2>${
    r.activity
      .slice(0, 8)
      .map(
        (a) =>
          `<p class="collab-meta-note">${esc(a.body)}<br>${esc(m.nameOf(a.actor))} · ${date(a.at)}</p>`,
      )
      .join("") ||
    '<p class="collab-meta-note">Shared draft created for this preview.</p>'
  }</section>`;
}
function reviewForm() {
  return `<section class="collab-section"><form id="review-form" class="collab-review"><h2>Quality assurance</h2>${[
    ["objectives", "Learning objectives"],
    ["content", "Content accuracy"],
    ["activities", "Learning activities"],
    ["assessment", "Assessment and answer key"],
  ]
    .map(
      ([key, title]) =>
        `<label>${title}<select name="${key}" required><option value="">Choose</option><option value="met">Met</option><option value="revise">Needs revision</option></select></label>`,
    )
    .join(
      "",
    )}<label class="bank-form-field">Review feedback<textarea name="feedback" maxlength="5000"></textarea></label><p class="form-error" role="alert"></p><div class="collab-inline"><button class="secondary" name="decision" value="returned" type="submit">Return for revision</button><button class="primary" name="decision" value="approved" type="submit">Approve</button></div></form></section>`;
}
function pdfPreview(url) {
  return `<div id="mock-pdf" data-url="${esc(url)}" class="collab-pdf-viewer"><div class="collab-inline"><button type="button" data-pdf-prev disabled>Previous page</button><span role="status">Loading PDF review copy…</span><button type="button" data-pdf-next disabled>Next page</button></div><canvas aria-label="PDF review copy"></canvas></div>`;
}
async function hydratePdf() {
  const target = document.querySelector("#mock-pdf");
  if (!target) return;
  const status = target.querySelector('[role="status"]');
  try {
    const pdfjs = await import(
      new URL("mock-assets/pdf.min.mjs", location.href).href
    );
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "mock-assets/pdf.worker.min.mjs",
      location.href,
    ).href;
    const pdf = await pdfjs.getDocument({
      url: target.dataset.url,
      isEvalSupported: false,
    }).promise;
    if (!target.isConnected) {
      await pdf.destroy();
      return;
    }
    let number = 1;
    const canvas = target.querySelector("canvas"),
      prev = target.querySelector("[data-pdf-prev]"),
      next = target.querySelector("[data-pdf-next]");
    async function draw() {
      prev.disabled = next.disabled = true;
      const page = await pdf.getPage(number),
        normal = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
          scale: Math.max(
            0.1,
            Math.min(1100, target.clientWidth - 24) / normal.width,
          ),
        }),
        ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      canvas.style.width = viewport.width + "px";
      canvas.style.height = viewport.height + "px";
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      }).promise;
      status.textContent = `Page ${number} of ${pdf.numPages}`;
      prev.disabled = number === 1;
      next.disabled = number === pdf.numPages;
    }
    const failed = () => {
      status.textContent =
        "Preview unavailable. Download the PDF review copy above.";
    };
    prev.onclick = () => {
      number--;
      draw().catch(failed);
    };
    next.onclick = () => {
      number++;
      draw().catch(failed);
    };
    await draw();
  } catch {
    status.textContent =
      "Preview unavailable. Download the PDF review copy above.";
  }
}
async function hydrateDocx() {
  const target = document.querySelector("#mock-docx");
  if (!target) return;
  try {
    const xml = await documentXml(
      await (await fetch(target.dataset.url)).arrayBuffer(),
    );
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    target.textContent = [
      ...parsed.getElementsByTagNameNS(
        "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "p",
      ),
    ]
      .map((p) => p.textContent)
      .join("\n\n");
  } catch {
    target.textContent =
      "This document could not be previewed. Download the DOCX to open it in Word.";
  }
}
function openDialog(title, body) {
  const dialog = document.querySelector("#mock-dialog");
  dialog.innerHTML = `<h2 id="dialog-title">${title}</h2>${body}`;
  dialog.showModal();
}
function closeDialog() {
  document.querySelector("#mock-dialog").close();
}
const formActions = (text) =>
  `<p class="form-error" role="alert"></p><div class="form-actions">${action("close-dialog", "Cancel", "", "secondary")}<button class="primary" type="submit">${text}</button></div>`;
function fileFields(optional = false) {
  return `<label class="bank-form-field">${optional ? "Replacement files (optional)" : "Resource file"}<input name="resource_file" type="file" accept=".pdf,.docx,.pptx,.mp4,.mp3" ${optional ? "" : "required"}><small>PDF, DOCX, PPTX: ${m.limits.documentMB} MB each · MP4: ${m.limits.videoMB} MB / ${m.limits.videoMinutes} min · MP3: ${m.limits.audioMB} MB / ${m.limits.audioMinutes} min</small></label><div data-paired hidden><label class="bank-form-field">PDF review copy<input type="file" name="review_pdf" accept=".pdf"><small>Use the PDF exported from this slide deck, up to ${m.limits.documentMB} MB. Both files stay together in the submitted version.</small></label></div><div data-media hidden><label class="bank-form-field">Transcript (recommended)<textarea name="transcript" maxlength="30000" placeholder="Add a text version of the spoken content"></textarea></label><label class="bank-form-field" data-caption>Video captions (optional)<input type="file" name="captions" accept=".vtt"><small>WebVTT (.vtt), up to 1 MB.</small></label><label class="collab-consent"><input type="checkbox" name="permission"><span>I created this recording or have permission to share it, and have permission from identifiable people who appear or speak in it.</span></label></div>`;
}
function newForm() {
  if (head())
    throw Error("Switch to a sample Teacher account to create a resource.");
  const input = (name, title, extra = "") =>
    `<label class="bank-form-field">${title}<input name="${name}" maxlength="200" required ${extra}></label>`;
  const select = (name, title, choices) =>
    `<label class="bank-form-field">${title}<select name="${name}" required><option value="">Choose ${title.toLowerCase()}</option>${choices.map((x) => `<option>${x}</option>`).join("")}</select></label>`;
  openDialog(
    "Create a shared draft",
    `<form id="new-form"><div class="bank-form-grid">${input("title", "Resource title")}${select("category", "Category", ["METHODS", "MODELS", "UNITS"])}${input("subject", "Learning area", 'placeholder="e.g. Science"')}${select(
      "grade",
      "Grade",
      [7, 8, 9, 10].map((n) => "Grade " + n),
    )}${select(
      "quarter",
      "Quarter",
      [1, 2, 3, 4].map((n) => "Quarter " + n),
    )}<label class="bank-form-field">Owner<input value="${esc(current().name)}" readonly></label></div><label class="bank-form-field">Description<textarea name="description" required maxlength="5000"></textarea></label><label class="bank-form-field">Learning competency<textarea name="competency" required maxlength="3000"></textarea></label><label class="bank-form-field">Contextualization / Localization<textarea name="localization" required maxlength="5000"></textarea></label>${fileFields()}${formActions("Create draft")}</form>`,
  );
}
function inviteForm() {
  const r = m.resource(state, selected),
    choices = m.people.filter(
      (p) =>
        p.role === "teacher" &&
        p.id !== actor &&
        !r.contributors.some((c) => c.id === p.id && c.status !== "declined"),
    );
  openDialog(
    "Invite a contributor",
    `<form id="invite-form"><p class="collab-meta-note">Invitations appear inside the sample account's Invitations page. Accepting gives access to this draft; the owner remains responsible for submission.</p><label class="bank-form-field">Teacher<select name="teacher" required><option value="">Choose a Teacher</option>${choices.map((p) => `<option value="${p.id}">${esc(p.name)} · ${esc(p.department)}</option>`).join("")}</select></label>${!choices.length ? '<p class="collab-meta-note">All sample Teachers have already been invited.</p>' : ""}${formActions("Send invitation")}</form>`,
  );
}
function filesForm(kind) {
  const propose = kind === "proposal";
  openDialog(
    propose ? "Propose a revision" : "Update working files",
    `<form id="${propose ? "proposal-form" : "files-form"}"><p class="collab-meta-note">${propose ? "Your proposal stays separate until the owner selects your files. You can also leave a text-only suggestion." : "These files replace only the working package. Earlier submitted and approved versions are preserved."}</p>${fileFields(propose)}<label class="bank-form-field">Describe the changes<textarea name="notes" required maxlength="3000" placeholder="Explain what changed and which parts the owner should review"></textarea></label>${formActions(propose ? "Send proposal" : "Save working files")}</form>`,
  );
}
function submitDialog() {
  const r = m.resource(state, selected),
    f = r.working?.attachment;
  openDialog(
    "Submit this version for review?",
    `<p class="collab-meta-note">The current files and contributor credits will be fixed as version ${r.versions.length + 1}. Further draft changes are disabled until review. The existing four-item checklist stays the same.</p>${f ? fileRow(f, f.type.toUpperCase()) + (f.preview ? fileRow(f.preview, "Paired PDF review copy", "pdf") : "") : ""}<div class="form-actions">${action("close-dialog", "Cancel", "", "secondary")}${action("confirm-submit", "Submit for review", "", "primary")}</div>`,
  );
}
function limitsForm() {
  openDialog(
    "File limits for this mock",
    `<form id="limits-form"><p class="collab-meta-note">The document limit stays at 20 MB per file. Adjust the proposed video and audio limits here to try the upload experience. Changes affect this tab only.</p><table class="collab-limit-table"><thead><tr><th>Format</th><th>Maximum MB</th><th>Maximum minutes</th></tr></thead><tbody><tr><td>PDF / DOCX / PPTX</td><td>20 each</td><td>—</td></tr><tr><td>MP4</td><td><input aria-label="Video maximum MB" name="videoMB" type="number" min="1" max="500" value="${m.limits.videoMB}" required></td><td><input aria-label="Video maximum minutes" name="videoMinutes" type="number" min="1" max="60" value="${m.limits.videoMinutes}" required></td></tr><tr><td>MP3</td><td><input aria-label="Audio maximum MB" name="audioMB" type="number" min="1" max="100" value="${m.limits.audioMB}" required></td><td><input aria-label="Audio maximum minutes" name="audioMinutes" type="number" min="1" max="120" value="${m.limits.audioMinutes}" required></td></tr></tbody></table>${formActions("Apply in this mock")}</form>`,
  );
}
document.addEventListener("change", (event) => {
  if (!activePreview()) return;
  if (embedded && !event.target.closest("#bank-collaboration-preview")) return;
  if (event.target.id === "preview-person") {
    actor = event.target.value;
    const r = selected && m.resource(state, selected);
    if (r && !m.canSee(r, actor)) selected = null;
    if (!selected) scope = head() ? "review" : "drafts";
    versionView = null;
    query = "";
    category = "";
    render();
  }
  if (event.target.name === "resource_file") {
    const form = event.target.form,
      type = fileType(event.target.files[0]);
    form.querySelector("[data-paired]").hidden = type !== "pptx";
    form.elements.review_pdf.required = type === "pptx";
    form.querySelector("[data-media]").hidden = !["mp4", "mp3"].includes(type);
    form.elements.permission.required = ["mp4", "mp3"].includes(type);
    form.querySelector("[data-caption]").hidden = type !== "mp4";
  }
});
document.addEventListener("input", (event) => {
  if (!activePreview()) return;
  if (embedded && !event.target.closest("#bank-collaboration-preview")) return;
  if (event.target.id === "mock-search") {
    query = event.target.value;
    document.querySelector("#mock-table").innerHTML = table(visibleRows());
  }
});
document.addEventListener("click", (event) => {
  if (!activePreview()) return;
  if (embedded && !event.target.closest("#bank-collaboration-preview")) return;
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled || formBusy) return;
  const actionName = button.dataset.action,
    id = button.dataset.id || selected;
  try {
    switch (actionName) {
      case "menu":
        document.querySelector(".app").classList.toggle("mock-nav-open");
        break;
      case "navigate":
        scope = button.dataset.scope;
        selected = null;
        versionView = null;
        category = "";
        query = "";
        render();
        break;
      case "category":
        scope = "bank";
        category = button.dataset.category;
        query = "";
        selected = null;
        render();
        break;
      case "clear-filter":
        category = "";
        query = "";
        render();
        break;
      case "open":
        selected = id;
        versionView = null;
        render();
        break;
      case "back":
        selected = null;
        versionView = null;
        render();
        break;
      case "new":
        newForm();
        break;
      case "invite":
        inviteForm();
        break;
      case "files":
        filesForm("owner");
        break;
      case "propose":
        filesForm("proposal");
        break;
      case "close-dialog":
        closeDialog();
        break;
      case "submit":
        submitDialog();
        break;
      case "confirm-submit":
        m.submit(state, selected, actor);
        closeDialog();
        versionView = null;
        render();
        toast("Version submitted. Files and credits are locked for review.");
        break;
      case "accept":
        m.answerInvite(state, id, actor, true);
        selected = id;
        scope = "drafts";
        versionView = null;
        render();
        toast("Invitation accepted.");
        break;
      case "decline":
        m.answerInvite(state, id, actor, false);
        render();
        toast("Invitation declined.");
        break;
      case "select-proposal":
        m.selectProposal(state, selected, actor, button.dataset.proposal);
        render();
        toast("Proposed files selected for the working draft.");
        break;
      case "revision":
        m.startRevision(state, selected, actor);
        scope = "mine";
        versionView = null;
        render();
        toast("New draft started. The approved version is preserved.");
        break;
      case "working":
        versionView = null;
        scope = "mine";
        render();
        break;
      case "published":
        versionView = m.resource(state, selected).published;
        render();
        break;
      case "version":
        versionView = Number(button.dataset.version);
        render();
        break;
      case "archive":
      case "restore":
        m.archive(state, id, actor, actionName === "archive");
        if (actionName === "restore" && !selected) render();
        else render();
        toast(
          actionName === "archive"
            ? "Resource archived."
            : "Resource restored to its previous status.",
        );
        break;
      case "limits":
        limitsForm();
        break;
      case "reset":
        openDialog(
          "Reset this mock?",
          `<p class="collab-meta-note">This clears changes and locally uploaded files in this preview tab. The current website is not affected.</p><div class="form-actions">${action("close-dialog", "Cancel", "", "secondary")}${action("confirm-reset", "Reset sample data", "", "primary")}</div>`,
        );
        break;
      case "confirm-reset":
        closeDialog();
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.clear();
        state = m.initialState();
        actor = "tom";
        scope = "drafts";
        selected = null;
        versionView = null;
        query = "";
        category = "";
        Object.assign(m.limits, {
          documentMB: 20,
          videoMB: 100,
          videoMinutes: 10,
          audioMB: 25,
          audioMinutes: 20,
        });
        render();
        toast("Sample data reset.");
        break;
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("submit", async (event) => {
  if (!activePreview()) return;
  if (embedded && !event.target.closest("#bank-collaboration-preview")) return;
  const form = event.target;
  if (
    ![
      "new-form",
      "files-form",
      "proposal-form",
      "invite-form",
      "comment-form",
      "review-form",
      "limits-form",
    ].includes(form.id)
  )
    return;
  event.preventDefault();
  if (formBusy) return;
  const error = form.querySelector(".form-error"),
    buttons = [...form.querySelectorAll("button")],
    data = new FormData(form),
    decision = event.submitter?.value;
  error.textContent = "";
  formBusy = true;
  buttons.forEach((b) => (b.disabled = true));
  try {
    switch (form.id) {
      case "new-form": {
        const attachment = await readPackage(form, registerUrl);
        const r = m.createResource(
          state,
          actor,
          Object.fromEntries(
            [...data].filter(([key]) =>
              [
                "title",
                "category",
                "subject",
                "grade",
                "quarter",
                "description",
                "localization",
                "competency",
              ].includes(key),
            ),
          ),
          attachment,
        );
        selected = r.id;
        scope = "mine";
        versionView = null;
        closeDialog();
        toast("Draft created. Invite a Teacher to work together.");
        break;
      }
      case "files-form":
        m.updateDraft(
          state,
          selected,
          actor,
          await readPackage(form, registerUrl),
          String(data.get("notes")),
        );
        closeDialog();
        toast("Working files updated.");
        break;
      case "proposal-form":
        m.propose(
          state,
          selected,
          actor,
          String(data.get("notes")),
          data.get("resource_file")?.size
            ? await readPackage(form, registerUrl)
            : null,
        );
        closeDialog();
        toast("Proposal sent to the owner.");
        break;
      case "invite-form":
        m.invite(state, selected, actor, String(data.get("teacher")));
        closeDialog();
        toast("Invitation added to the sample Teacher's inbox.");
        break;
      case "comment-form":
        m.comment(state, selected, actor, String(data.get("body")));
        toast("Comment posted.");
        break;
      case "review-form":
        m.review(
          state,
          selected,
          actor,
          decision,
          Object.fromEntries(
            ["objectives", "content", "activities", "assessment"].map((key) => [
              key,
              data.get(key),
            ]),
          ),
          String(data.get("feedback")),
        );
        versionView = null;
        toast(
          decision === "approved"
            ? "Resource approved. It is now available in the Digital Bank."
            : "Resource returned. The shared draft is open for revision.",
        );
        break;
      case "limits-form":
        for (const key of [
          "videoMB",
          "videoMinutes",
          "audioMB",
          "audioMinutes",
        ])
          m.limits[key] = Number(data.get(key));
        closeDialog();
        toast("Mock file limits updated.");
        break;
    }
    render();
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    formBusy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
});
window.addEventListener("beforeunload", () =>
  objectUrls.forEach((url) => URL.revokeObjectURL(url)),
);
if (!window.sikapBackend) render();
