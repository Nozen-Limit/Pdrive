let accountFilter = "all";
const accountLabel = (s) =>
  ({ pending: "Pending approval", approved: "Approved", rejected: "Rejected" })[
    s
  ] || "Setup required";
function teachersPage() {
  const teachers = data.teachers.filter((u) => u.role === "teacher"),
    pending = teachers.filter((u) => u.approval_status === "pending").length,
    list = teachers.filter(
      (u) => accountFilter === "all" || u.approval_status === accountFilter,
    );
  return `<div class="toolbar"><div class="filters">${["all", "approved", "pending", "rejected"].map((s) => `<button class="filter ${accountFilter === s ? "active" : ""}" onclick="accountFilter='${s}';render()">${s === "all" ? "All teachers" : accountLabel(s)}${s === "pending" ? ` (${pending})` : ""}</button>`).join("")}</div><button class="secondary" onclick="load()">Refresh</button></div><div class="panel"><div class="panel-head"><h2>Teachers</h2><span class="muted">${list.length}</span></div><div class="account-list">${list.map((u) => `<article class="account-row"><div><strong>${esc(u.name)}</strong><div class="module-meta">${esc(u.email)}</div><div class="module-meta">${u.role === "head" ? "Head Teacher" : "Teacher"} · Requested ${date(u.requested_at)}</div>${u.approval_note ? `<p>${esc(u.approval_note)}</p>` : ""}</div><div class="account-actions"><button class="action-btn" onclick="teacherProfile('${u.id}')">View profile</button><span class="badge ${u.approval_status === "approved" ? "approved" : u.approval_status === "pending" ? "pending" : "returned"}">${accountLabel(u.approval_status)}</span>${u.approval_status === "pending" && u.role === "teacher" ? (u.emailConfirmed ? `<button class="action-btn" onclick="accountDecisionModal('${u.id}')">Review account</button>` : '<span class="module-meta">Email not confirmed</span>') : ""}</div></article>`).join("") || '<div class="empty"><h3>No accounts here</h3><p>New registrations appear under Pending approval.</p></div>'}</div></div>`;
}
function teacherProfile(uid) {
  if (data.user.role !== "head") return;
  const u = data.teachers.find((u) => u.id === uid && u.role === "teacher");
  if (!u) return;
  const initials = u.name
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    chips = (items) =>
      items?.length
        ? items
            .map(
              (item) => `<span class="teacher-detail-chip">${esc(item)}</span>`,
            )
            .join("")
        : '<span class="muted">Not provided</span>';
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal teacher-profile-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-profile-title"><div class="modal-head"><h2 id="teacher-profile-title">Teacher profile</h2><button class="close" onclick="closeModal()" aria-label="Close">×</button></div><div class="teacher-profile-header"><div class="profile-avatar">${avatarContent(u)}</div><div><h3>${esc(u.name)}</h3><p class="module-meta">${esc(u.email)}</p><span class="profile-role">Teacher</span></div></div><dl class="teacher-profile-details"><dt>Department</dt><dd>${esc(u.assignment) || '<span class="muted">Not provided</span>'}</dd><dt>Subjects handled</dt><dd class="teacher-chip-list">${chips(u.subjects)}</dd><dt>Grade levels</dt><dd class="teacher-chip-list">${chips(u.grade_levels)}</dd><dt>Account status</dt><dd>${accountLabel(u.approval_status)}</dd><dt>Email confirmation</dt><dd>${u.emailConfirmed ? "Confirmed" : "Not confirmed"}</dd></dl><div class="form-actions">${u.approval_status === "pending" && u.emailConfirmed ? `<button class="primary" onclick="accountDecisionModal('${u.id}')">Review account</button>` : ""}<button class="secondary" onclick="closeModal()">Close</button></div></section>`;
  $(".teacher-profile-modal .close").focus();
}
function accountDecisionModal(uid) {
  const u = data.teachers.find((u) => u.id === uid);
  if (!u || data.user.role !== "head") return;
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="account-review-title"><div class="modal-head"><h2 id="account-review-title">Review teacher account</h2><button class="close" onclick="closeModal()" aria-label="Close">×</button></div><strong>${esc(u.name)}</strong><p class="muted">${esc(u.email)}</p><p>Approval grants Teacher access only. Head Teacher accounts are provisioned separately.</p><form onsubmit="decideAccount(event,'${uid}')"><div class="field"><label for="account-note">Decision note (optional)</label><textarea id="account-note" name="note" maxlength="2000" placeholder="A short explanation for the teacher"></textarea></div><p class="form-error" role="alert"></p><div class="decision"><button class="approve-btn" type="submit" name="decision" value="approved">Approve Teacher</button><button class="return-btn" type="submit" name="decision" value="rejected">Reject request</button></div></form></section>`;
}
async function decideAccount(e, uid) {
  const decision = e.submitter?.value;
  await formSave(e, async (form) => {
    await api("accounts/" + uid, {
      method: "POST",
      body: JSON.stringify({ decision, note: form.elements.note.value }),
    });
    toast(
      decision === "approved"
        ? "Teacher account approved."
        : "Account request rejected.",
    );
  });
}
function approvalPage() {
  const u = data.user,
    status = u?.approval_status,
    rejected = status === "rejected",
    configured = !!status;
  $("#app").innerHTML =
    `<main class="centered-login clean-login"><section class="login-card centered-card school-login approval-card"><div class="clean-brand">Project Sikap</div><h1>${!configured ? "Database update needed" : rejected ? "Request not approved" : "Awaiting approval"}</h1><p>${!configured ? "Your school administrator needs to run the account-approval database update." : rejected ? "The Head Teacher has declined your account request. Contact your school for assistance." : "Your account is registered. A Head Teacher must approve it before you can access school modules."}</p><p class="approval-email">${esc(u?.email)}</p>${u?.approval_note ? `<div class="approval-feedback"><strong>Head Teacher note</strong><p>${esc(u.approval_note)}</p></div>` : ""}<div class="form-actions"><button class="secondary" onclick="logout()">Log out</button><button class="primary" onclick="load()">Check status</button></div></section></main>`;
}
