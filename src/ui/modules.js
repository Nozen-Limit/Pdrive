function moduleResults() {
  const list = filtered();
  return `<div class="panel-head"><span class="muted">${list.length} module${list.length === 1 ? "" : "s"}</span>${view === "dashboard" ? '<button class="link-btn" onclick="go(\'modules\')">View all</button>' : ""}</div><div class="module-list">${list.map((m) => `<div class="module-row"><div><button class="module-title text-button" onclick="openModule('${m.id}')">${esc(m.title)}</button><div class="module-meta">${esc(m.subject)} · ${esc(m.grade)} · ${esc(m.term)} · v${m.version}</div><div class="module-meta">${esc(m.teacher)} · Updated ${date(m.updated)}${m.file ? " · " + size(m.size) : ""}</div>${workflowModuleDue(m)}</div><div class="row-actions"><button class="icon-btn star-btn" aria-label="${m.starred ? "Unstar" : "Star"} ${esc(m.title)}" onclick="starModule('${m.id}')">${ico(m.starred ? "star" : "star_outline")}</button>${badge(m.status)}<button class="action-btn" onclick="openModule('${m.id}')">${view === "reviews" ? "Review" : "Open"}</button></div></div>`).join("") || '<div class="empty"><h3>No modules here yet</h3><p>Try changing the filters. New submissions appear here.</p></div>'}</div>`;
}
function workspaceBanner(head) {
  const modules = data.modules.filter((m) => !m.archived);
  const pending = modules.filter((m) => m.status === "pending").length;
  const returned = modules.filter((m) => m.status === "returned").length;
  const approved = modules.filter((m) => m.status === "approved").length;
  const actions = head
    ? [
        ["reviews", "Pending reviews", pending],
        ["library", "Approved modules", approved],
        [
          "teachers",
          "Teachers",
          data.teachers.filter(
            (t) => t.role === "teacher" && t.approval_status === "approved",
          ).length,
        ],
      ]
    : [
        ["submit", "Submit module", null],
        ["modules", "My modules", modules.length],
        ["requirements", "Requirements", null],
      ];
  return `<section class="workspace-hero"><div class="workspace-hero-copy"><span class="workspace-role">${head ? "Head Teacher" : "Teacher"}</span><h2>${head ? "Review queue" : "Your modules"}</h2><p>${head ? (pending ? pending + " submission" + (pending === 1 ? "" : "s") + " awaiting review." : "No submissions awaiting review.") : returned ? returned + " module" + (returned === 1 ? "" : "s") + " need" + (returned === 1 ? "s" : "") + " revision." : "No revisions requested."}</p><div class="workspace-actions">${actions.map(([route, label, count], i) => `<button class="${i === 0 ? "workspace-action-primary" : ""}" aria-label="${label}" title="${label}" onclick="go('${route}')">${route === "submit" ? "+" : label}${count !== null ? `<span>${count}</span>` : route === "submit" ? "" : ico("north_east")}</button>`).join("")}</div></div><div id="head-desk" data-desk-role="${head ? "head" : "teacher"}" class="workspace-desk" aria-label="School desk"><div class="real-desk-art" aria-hidden="true"></div><button class="desk-hotspot desk-notebook" aria-label="${head ? "Review modules" : "Submit module"}" title="${head ? "Review modules" : "Submit module"}" onclick="go('${head ? "reviews" : "submit"}')">${head ? "Review modules" : "+"}</button><button class="desk-hotspot desk-documents" onclick="go('${head ? "library" : "modules"}')">${head ? "Approved modules" : "My modules"}</button></div></section>`;
}
function headDesk() {
  return workspaceBanner(true);
}
function teacherDesk() {
  return workspaceBanner(false);
}
function modulePage() {
  const total = filtered();
  return `${view === "dashboard" ? (data.user.role === "head" ? headDesk() : teacherDesk()) : ""}${view === "dashboard" ? workflowAttention() : ""}${filterPanel()}${view === "dashboard" ? `<div class="cards">${stat("Total modules", total.length, "#e8f1ff")}${stat("Pending review", total.filter((m) => m.status === "pending").length, "#fff3cf")}${stat("Approved", total.filter((m) => m.status === "approved").length, "#e4f3e9")}${stat("Needs revision", total.filter((m) => m.status === "returned").length, "#f9e7ea")}</div>` : ""}${view === "library" ? '<p class="muted">Final approved versions, accessible to their submitting teacher and head teachers.</p>' : ""}<div class="${view === "dashboard" ? "grid-2" : ""}"><div class="panel" id="module-results">${moduleResults()}</div>${
    view === "dashboard"
      ? `<aside><div class="panel"><div class="panel-head"><h3>Pinned notes</h3><button class="link-btn" onclick="go('notes')">Manage</button></div>${
          data.notes
            .filter((n) => n.pinned)
            .map(
              (n) =>
                `<div class="note"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div>`,
            )
            .join("") || '<p class="muted">No pinned notes.</p>'
        }</div><div class="panel activity-panel"><h3>Recent activity</h3>${activity(data.events.slice(0, 5))}</div></aside>`
      : ""
  }</div>`;
}
function activity(events) {
  return `<div class="activity">${events.map((e) => `<div class="activity-item"><i class="dot"></i><div><p>${esc(e.body)}${e.title ? ` · ${esc(e.title)}` : ""}</p><small>${esc(e.actorName)} · ${date(e.created)}</small></div></div>`).join("") || '<p class="muted">Activity appears after a submission or review.</p>'}</div>`;
}
function field(name, title, html, full = false) {
  return `<div class="field ${full ? "full" : ""}"><label for="${name}">${title}</label>${html}</div>`;
}
function submitPage() {
  if (data.user.role === "head") return "";
  queueMicrotask(() => applyRequirement());
  const year = new Date().getFullYear();
  return `<div class="panel form-panel"><div class="panel-head"><h2>Module details</h2></div><form onsubmit="submitModule(event)">${requirementPicker()}<div class="form-grid">${field("title", "Module title", '<input id="title" name="title" maxlength="200" required placeholder="e.g. Fractions in everyday life">', true)}${field("subject", "Subject", `<select id="subject" name="subject">${subjects.map((s) => `<option>${s}</option>`).join("")}</select>`)}${field("grade", "Grade / Year level", `<select id="grade" name="grade">${Array.from({ length: 12 }, (_, i) => `<option>Grade ${i + 1}</option>`).join("")}</select>`)}${field("term", "Quarter / Semester", '<select id="term" name="term"><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option><option>Semester 1</option><option>Semester 2</option></select>')}${field("year", "School year", `<input id="year" name="year" value="${year}–${year + 1}" maxlength="200" required>`)}${field("teacher", "Teacher name", `<input id="teacher" value="${esc(data.user.name)}" readonly>`)}${field("file", "Module file", '<div class="upload"><input id="file" name="file" type="file" accept=".pdf,.docx" required><p class="muted">PDF or DOCX · maximum 20 MB</p></div>', true)}${field("remarks", "Remarks (optional)", '<textarea id="remarks" name="remarks" maxlength="3000" placeholder="Context for your reviewer"></textarea>', true)}</div><p class="muted">The submission date is recorded automatically.</p><p class="form-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" onclick="go('modules')">Cancel</button><button class="primary" type="submit">Submit for review</button></div></form></div>`;
}
async function formSave(e, fn) {
  e.preventDefault();
  if (busy) return;
  busy = true;
  const form = e.target,
    button = form.querySelector('button[type="submit"]'),
    error = form.querySelector(".form-error");
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((b) => (b.disabled = true));
  const old = button.textContent;
  button.textContent = "Saving…";
  error.textContent = "";
  let saved = false;
  try {
    await fn(form);
    saved = true;
    dirty = false;
    data = await api("state");
    render();
  } catch (e) {
    error.textContent = saved
      ? "Saved successfully, but the page could not refresh. Reload before making another change."
      : e.message;
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
    button.disabled = saved;
    button.textContent = old;
  }
}
async function submitModule(e) {
  if (data.user.role === "head") {
    e.preventDefault();
    return;
  }
  await formSave(e, async (form) => {
    const result = await api("modules", {
      method: "POST",
      body: new FormData(form),
    });
    view = "modules";
    toast("Module uploaded and submitted for review.");
  });
}
async function openModule(mid) {
  if (busy) return;
  if (dirty && !confirm("Discard your unsaved changes?")) return;
  try {
    const fresh = await api("state"),
      next = await api("modules/" + mid);
    data = fresh;
    detail = next;
    dirty = false;
    view = "review";
    render();
  } catch (e) {
    toast(e.message);
  }
}
function fileUrl(m, v, download = false) {
  const version = detail?.versions.find((x) => x.version === v);
  return download ? version?.downloadUrl || "#" : version?.url || "#";
}
function reviewPage() {
  if (!detail) return "";
  const m = detail.module,
    v = detail.versions.find((v) => v.version === m.version),
    canReview =
      data.user.role === "head" &&
      m.owner !== data.user.id &&
      m.status === "pending" &&
      !m.archived;
  return `<div class="toolbar"><button class="secondary" onclick="go('modules')">Back to modules</button>${badge(m.status)}</div><div class="review-layout"><section><div class="panel"><h2>${esc(m.title)}</h2><p class="muted">${esc(m.subject)} · ${esc(m.grade)} · ${esc(m.term)} · ${esc(m.year)}</p><div class="file-toolbar"><strong>${esc(v.name)}</strong><span class="muted">v${v.version} · ${size(v.size)}</span>${v.unavailable ? '<span class="muted">File unavailable</span>' : `<a class="action-btn" href="${fileUrl(m, v.version, true)}">Download</a>`}</div>${v.unavailable ? '<div class="file-unavailable" role="status">This file is unavailable. Refresh the module to renew access, or contact the administrator if it is still missing.</div>' : v.type === "application/pdf" ? `<iframe class="pdf-preview" title="${esc(m.title)} PDF preview" src="${fileUrl(m, v.version)}"></iframe>` : `<div class="doc-preview"><div><h3>DOCX document</h3><p>Download this file to read it in Word or your document editor.</p><a class="primary" href="${fileUrl(m, v.version, true)}">Download DOCX</a></div></div>`}</div><div class="panel activity-panel"><h3>Version history</h3><div class="version-list">${detail.versions.map((v) => `<div class="version-entry"><div><strong>Version ${v.version}${m.final_version === v.version ? " · Approved final" : ""}</strong><p class="module-meta">${date(v.created)} · ${esc(v.name)} · ${size(v.size)}</p><p>${esc(v.changes)}</p></div><a class="action-btn" href="${fileUrl(m, v.version, true)}">Download</a></div>`).join("")}</div></div><div class="panel activity-panel"><h3>Activity history</h3>${activity(detail.events)}</div></section><aside><div class="panel"><h3>Submission details</h3><dl class="detail-list"><div class="detail"><dt>Teacher</dt><dd>${esc(m.teacher)}</dd></div><div class="detail"><dt>Submitted</dt><dd>${date(m.created)}</dd></div>${m.deadline ? `<div class="detail"><dt>Due date</dt><dd>${date(m.deadline)}</dd></div>` : ""}${m.approved ? `<div class="detail"><dt>Approved by</dt><dd>${esc(data.modules.find((x) => x.id === m.id)?.approverName || "Head teacher")}</dd></div><div class="detail"><dt>Approved on</dt><dd>${date(m.approved)}</dd></div>` : ""}</dl>${moduleRequirementDetails(m)}${reviewHistory(m.id)}${m.remarks ? `<h4>Teacher remarks</h4><p>${esc(m.remarks)}</p>` : ""}${m.status === "approved" ? '<p class="lock-message">Approved version locked. This document cannot be replaced.</p>' : ""}${data.user.role === "head" && m.owner !== data.user.id && !m.archived ? '<button class="secondary" onclick="alertModal()">Send teacher alert</button>' : ""}${canReview ? `<form onsubmit="reviewDecision(event)">${reviewChecklist()}<div class="field"><label for="feedback">Required changes / review notes</label><textarea id="feedback" name="feedback" maxlength="5000" placeholder="List the changes needed, including page or activity references."></textarea></div><p class="form-error" role="alert"></p><div class="decision"><button type="submit" class="approve-btn" name="decision" value="approved">Approve</button><button type="submit" class="return-btn" name="decision" value="returned">Return for revision</button></div></form>` : ""}${m.owner === data.user.id && m.status === "returned" && !m.archived ? `<form class="revision-form" onsubmit="resubmitModule(event)"><h4>Submit a revised version</h4><div class="field"><label for="revision-file">Revised PDF / DOCX</label><input id="revision-file" name="file" type="file" accept=".pdf,.docx" required></div><div class="field"><label for="changes">What changed?</label><textarea id="changes" name="changes" required maxlength="3000"></textarea></div><p class="form-error" role="alert"></p><button class="primary" type="submit">Upload and resubmit</button></form>` : ""}</div><div class="panel activity-panel"><h3>Comments and feedback</h3><div class="comments">${detail.comments.map((c) => `<article class="comment"><strong>${esc(c.authorName)}</strong><small class="module-meta">${date(c.created)} · v${c.version}</small><p>${esc(c.body)}</p></article>`).join("") || '<p class="muted">No feedback yet.</p>'}</div>${!m.archived ? `<form onsubmit="addComment(event)"><div class="field"><label for="comment">Add a comment</label><textarea id="comment" name="body" required maxlength="5000"></textarea></div><p class="form-error" role="alert"></p><button type="submit" class="secondary">Post comment</button></form>` : ""}</div></aside></div>`;
}
function alertModal() {
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="alert-title"><div class="modal-head"><h2 id="alert-title">Send teacher alert</h2><button class="close" onclick="closeModal()" aria-label="Close">×</button></div><p>To ${esc(detail.module.teacher)} · ${esc(detail.module.title)}</p><form onsubmit="sendAlert(event)"><div class="field"><label for="alert-message">Message</label><textarea id="alert-message" name="message" required maxlength="2000"></textarea></div><p class="muted">Appears in the teacher’s notifications. No email is sent.</p><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button type="submit" class="primary">Send alert</button></div></form></section>`;
  $("#alert-message").focus();
}
async function sendAlert(e) {
  await formSave(e, async (form) => {
    await api("modules/" + detail.module.id + "/alert", {
      method: "POST",
      body: JSON.stringify({ body: form.elements.message.value }),
    });
    detail = await api("modules/" + detail.module.id);
    toast("Alert sent to the teacher.");
  });
}
async function reviewDecision(e) {
  const decision = e.submitter.value;
  await formSave(e, async (form) => {
    await api(`modules/${detail.module.id}/decision`, {
      method: "POST",
      body: JSON.stringify({
        status: decision,
        feedback: form.feedback.value,
        checklist: readChecklist(form),
        revision: detail.module.revision,
      }),
    });
    detail = await api("modules/" + detail.module.id);
    toast(
      decision === "approved"
        ? "Final version approved."
        : "Returned with feedback.",
    );
  });
}
async function resubmitModule(e) {
  await formSave(e, async (form) => {
    const body = new FormData(form);
    body.set("revision", detail.module.revision);
    await api(`modules/${detail.module.id}/revise`, { method: "POST", body });
    detail = await api("modules/" + detail.module.id);
    toast("New version submitted. Prior files preserved.");
  });
}
async function addComment(e) {
  await formSave(e, async (form) => {
    await api(`modules/${detail.module.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: form.body.value }),
    });
    detail = await api("modules/" + detail.module.id);
    toast("Comment posted.");
  });
}
async function starModule(mid) {
  try {
    await api(`modules/${mid}/star`, { method: "POST", body: "{}" });
    data = await api("state");
    render();
  } catch (e) {
    toast(e.message);
  }
}
