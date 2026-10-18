const workflowCriteria = {
  objectives: "Learning objectives",
  content: "Content accuracy",
  activities: "Learning activities",
  assessment: "Assessment and answer key",
};
let requirementChoice = "",
  requirementFilter = "active",
  complianceRequirement = "all";
const dueLabel = (s) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function workflowUnavailable() {
  return '<div class="panel workflow-setup"><h2>School workflow setup required</h2><p>The administrator must apply the school workflow database update before requirements and review checklists can be used.</p></div>';
}
function workflowAttention() {
  if (!data.workflowReady) return "";
  const rows = (data.assignments || []).filter(
      (a) =>
        !data.requirements.find((r) => r.id === a.requirement_id)?.cancelled,
    ),
    missing = rows.filter((a) => a.status === "missing").length,
    returned = rows.filter((a) => a.status === "returned").length,
    overdue = rows.filter((a) => a.overdue).length;
  return `<div class="workflow-attention"><div><strong>Requirements</strong><span>${missing} not submitted · ${returned} need revision${overdue ? " · " + overdue + " overdue" : ""}</span></div><button class="action-btn" onclick="go('requirements')">View requirements</button></div>`;
}
function requirementsPage() {
  if (!data.workflowReady) return workflowUnavailable();
  const head = data.user.role === "head",
    list = (data.requirements || []).filter(
      (r) =>
        requirementFilter === "all" ||
        (requirementFilter === "cancelled" ? r.cancelled : !r.cancelled),
    );
  return `<div class="toolbar"><div class="filters">${["active", "cancelled", "all"].map((k) => `<button class="filter ${requirementFilter === k ? "active" : ""}" onclick="requirementFilter='${k}';render()">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>${head ? '<button class="primary" onclick="requirementModal()">New requirement</button>' : ""}</div><p class="muted workflow-timezone">Deadlines are shown in ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p><div class="requirements-list">${
    list
      .map((r) => {
        const rows = data.assignments.filter((a) => a.requirement_id === r.id),
          submitted = rows.filter((a) => a.status !== "missing").length;
        return `<article class="panel requirement-card"><div class="panel-head"><div><h2>${esc(r.title)}</h2><p class="module-meta">${esc(r.subject)} · ${esc(r.grade)} · ${esc(r.term)} · ${esc(r.year)}</p></div><span class="badge ${r.cancelled ? "returned" : new Date(r.due_at) < new Date() ? "pending" : "approved"}">${r.cancelled ? "Cancelled" : "Due " + esc(dueLabel(r.due_at))}</span></div>${r.instructions ? `<p class="requirement-instructions">${esc(r.instructions)}</p>` : ""}<div class="requirement-summary">${submitted} / ${rows.length} submitted · ${rows.filter((a) => a.status === "approved").length} approved · ${rows.filter((a) => a.overdue).length} overdue</div><div class="assignment-list">${rows.map((a) => assignmentRow(a, r)).join("")}</div>${head && !r.cancelled ? `<div class="form-actions"><button class="secondary" onclick="deadlineModal('${r.id}')">Change deadline</button><button class="secondary" onclick="cancelRequirement('${r.id}')">Cancel requirement</button></div>` : ""}<details class="requirement-log"><summary>Requirement history</summary>${(
          data.requirementEvents || []
        )
          .filter((e) => e.requirement === r.id)
          .map(
            (e) =>
              `<p>${esc(e.body)}<small>${esc(dueLabel(e.created))}</small></p>`,
          )
          .join("")}</details></article>`;
      })
      .join("") ||
    '<div class="panel empty"><h2>No requirements</h2><p>Assigned module requirements will appear here.</p></div>'
  }</div>`;
}
function assignmentRow(a, r) {
  const text = a.status === "missing" ? "Not submitted" : label(a.status);
  return `<div class="assignment-row"><div><strong>${esc(a.teacher)}</strong><div class="module-meta">${text}${a.overdue ? " · Overdue" : ""}${a.late ? " · Submitted late" : ""}${a.submitted_at ? " · " + esc(dueLabel(a.submitted_at)) : ""}</div></div>${a.module_id ? `<button class="action-btn" onclick="openModule('${a.module_id}')">${data.user.role === "head" && a.status === "pending" ? "Review" : "Open module"}</button>` : !r.cancelled && data.user.role === "teacher" ? `<button class="primary" onclick="submitRequirement('${r.id}')">Submit module</button>` : ""}</div>`;
}
function requirementModal() {
  if (data.user.role !== "head") return;
  const teachers = data.teachers.filter(
    (u) => u.role === "teacher" && u.approval_status === "approved",
  );
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal requirement-modal" role="dialog" aria-modal="true" aria-labelledby="requirement-title"><div class="modal-head"><h2 id="requirement-title">New requirement</h2><button class="close" aria-label="Close" onclick="closeModal()">×</button></div><form onsubmit="saveRequirement(event)"><div class="form-grid">${field("req-title", "Requirement title", '<input id="req-title" name="title" maxlength="200" required placeholder="e.g. Quarter 2 assessment module">', true)}${field("req-subject", "Subject", `<select id="req-subject" name="subject">${subjects.map((s) => `<option>${s}</option>`).join("")}</select>`)}${field("req-grade", "Grade level", `<select id="req-grade" name="grade">${Array.from({ length: 12 }, (_, i) => `<option>Grade ${i + 1}</option>`).join("")}</select>`)}${field("req-term", "Quarter / Semester", '<select id="req-term" name="term"><option>Quarter 1</option><option>Quarter 2</option><option>Quarter 3</option><option>Quarter 4</option><option>Semester 1</option><option>Semester 2</option></select>')}${field("req-year", "School year", `<input id="req-year" name="year" required maxlength="200" value="${new Date().getFullYear()}–${new Date().getFullYear() + 1}">`)}${field("req-due", "Deadline", '<input id="req-due" name="due_at" type="datetime-local" required>', true)}${field("req-instructions", "Instructions", '<textarea id="req-instructions" name="instructions" maxlength="3000"></textarea>', true)}</div><p class="module-meta">Deadline uses ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p><fieldset class="recipient-picker"><legend>Assign teachers</legend>${teachers.map((u) => `<label><input type="checkbox" name="teachers" value="${u.id}"><span>${esc(u.name)}<small>${esc(u.assignment || u.email)}</small></span></label>`).join("") || "<p>No approved teachers. Approve teacher accounts first.</p>"}</fieldset><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary" type="submit" ${teachers.length ? "" : "disabled"}>Create requirement</button></div></form></section>`;
  $("#req-title").focus();
}
async function saveRequirement(e) {
  await formSave(e, async (form) => {
    const f = new FormData(form),
      teachers = f.getAll("teachers");
    if (!teachers.length) throw Error("Select at least one teacher.");
    const due = new Date(f.get("due_at"));
    if (!Number.isFinite(+due) || due <= new Date())
      throw Error("Choose a future deadline.");
    await api("requirements", {
      method: "POST",
      body: JSON.stringify({
        details: {
          title: f.get("title"),
          subject: f.get("subject"),
          grade: f.get("grade"),
          term: f.get("term"),
          year: f.get("year"),
          instructions: f.get("instructions"),
          due_at: due.toISOString(),
        },
        teachers,
      }),
    });
    toast("Requirement created.");
  });
}
function deadlineModal(rid) {
  const r = data.requirements.find((r) => r.id === rid);
  if (!r || data.user.role !== "head") return;
  const local = new Date(
    +new Date(r.due_at) - new Date(r.due_at).getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="deadline-title"><div class="modal-head"><h2 id="deadline-title">Change deadline</h2><button class="close" aria-label="Close" onclick="closeModal()">×</button></div><p>${esc(r.title)}</p><form onsubmit="saveDeadline(event,'${r.id}')"><div class="field"><label for="new-due">Deadline (${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)})</label><input id="new-due" type="datetime-local" name="due_at" value="${local}" required></div><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Save deadline</button></div></form></section>`;
}
async function saveDeadline(e, rid) {
  await formSave(e, async (form) => {
    const r = data.requirements.find((r) => r.id === rid),
      due = new Date(form.elements.due_at.value);
    if (!Number.isFinite(+due) || due <= new Date())
      throw Error("Choose a future deadline.");
    await api("requirements/" + rid, {
      method: "PATCH",
      body: JSON.stringify({ revision: r.revision, due_at: due.toISOString() }),
    });
    toast("Deadline updated.");
  });
}
async function cancelRequirement(rid) {
  if (
    busy ||
    !confirm("Cancel this requirement? Submissions and history will remain.")
  )
    return;
  busy = true;
  try {
    const r = data.requirements.find((r) => r.id === rid);
    await api("requirements/" + rid, {
      method: "PATCH",
      body: JSON.stringify({ revision: r.revision, cancel: true }),
    });
    data = await api("state");
    render();
    toast("Requirement cancelled.");
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
async function submitRequirement(rid) {
  requirementChoice = rid;
  await go("submit");
}
function requirementPicker() {
  const options = (data.requirements || []).filter(
    (r) =>
      !r.cancelled &&
      (data.assignments || []).some(
        (a) =>
          a.requirement_id === r.id &&
          a.teacher_id === data.user.id &&
          a.status === "missing",
      ),
  );
  if (!options.some((r) => r.id === requirementChoice)) requirementChoice = "";
  return `<div class="field requirement-picker"><label for="submission-requirement">Requirement</label><select id="submission-requirement" name="requirement_id" onchange="requirementChoice=this.value;applyRequirement()"><option value="">Independent submission</option>${options.map((r) => `<option value="${r.id}" ${r.id === requirementChoice ? "selected" : ""}>${esc(r.title)} · Due ${esc(dueLabel(r.due_at))}</option>`).join("")}</select><p class="module-meta">Select the assigned requirement so your submission counts toward it.</p><p id="requirement-context" class="module-meta"></p></div>`;
}
function applyRequirement() {
  if (view !== "submit") return;
  const r = (data.requirements || []).find((r) => r.id === requirementChoice),
    select = $("#submission-requirement");
  if (!select) return;
  select.value = requirementChoice;
  for (const key of ["subject", "grade", "term", "year"]) {
    const el = $("#" + key);
    if (!el) continue;
    el.disabled = !!r;
    if (r) {
      if (
        el.tagName === "SELECT" &&
        ![...el.options].some((o) => o.value === r[key])
      )
        el.add(new Option(r[key], r[key]));
      el.value = r[key];
    }
  }
  const context = $("#requirement-context");
  if (context)
    context.textContent = r
      ? (r.instructions || "") + " Deadline: " + dueLabel(r.due_at)
      : "";
}
function reviewChecklist() {
  if (!data.workflowReady)
    return '<p class="form-error">Review checklist setup is required before recording a decision.</p>';
  return `<fieldset class="review-checklist"><legend>Review checklist</legend>${Object.entries(
    workflowCriteria,
  )
    .map(
      ([k, v]) =>
        `<div><label for="check-${k}">${v}</label><select id="check-${k}" name="check_${k}" required><option value="">Select result</option><option value="met">Meets requirements</option><option value="revise">Needs revision</option></select></div>`,
    )
    .join("")}</fieldset>`;
}
function readChecklist(form) {
  const checks = Object.fromEntries(
    Object.keys(workflowCriteria).map((k) => [
      k,
      form.elements["check_" + k]?.value || "",
    ]),
  );
  if (Object.values(checks).some((v) => !["met", "revise"].includes(v)))
    throw Error("Complete all review checklist items.");
  return checks;
}
function reviewHistory(mid) {
  const reviews = (data.reviews || []).filter((r) => r.module === mid);
  return reviews.length
    ? `<div class="review-history"><h4>Review decisions</h4>${reviews
        .map(
          (r) =>
            `<article><strong>Version ${r.version} · ${r.decision === "approved" ? "Approved" : "Returned for revision"}</strong><p class="module-meta">${esc(r.reviewerName)} · ${esc(dueLabel(r.created))}</p><ul>${Object.entries(
              workflowCriteria,
            )
              .map(
                ([k, title]) =>
                  `<li>${title}: <span class="${r.checklist[k] === "revise" ? "revision-needed" : ""}">${r.checklist[k] === "met" ? "Meets requirements" : "Needs revision"}</span></li>`,
              )
              .join(
                "",
              )}</ul>${r.feedback ? `<p class="requirement-instructions">${esc(r.feedback)}</p>` : ""}</article>`,
        )
        .join("")}</div>`
    : "";
}
function complianceRows() {
  return (data.assignments || []).filter((a) => {
    const r = data.requirements.find((r) => r.id === a.requirement_id);
    return (
      r &&
      !r.cancelled &&
      (complianceRequirement === "all" || r.id === complianceRequirement)
    );
  });
}
function complianceReport() {
  if (!data.workflowReady) return workflowUnavailable();
  const rows = complianceRows(),
    submitted = rows.filter((a) => a.status !== "missing").length;
  return `<section class="panel compliance-report"><div class="panel-head"><h2>Submission compliance</h2><button class="secondary" onclick="exportCompliance()">Export compliance CSV</button></div><div class="field"><label for="compliance-requirement">Requirement</label><select id="compliance-requirement" onchange="complianceRequirement=this.value;render()"><option value="all">All active requirements</option>${data.requirements
    .filter((r) => !r.cancelled)
    .map(
      (r) =>
        `<option value="${r.id}" ${complianceRequirement === r.id ? "selected" : ""}>${esc(r.title)}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="compliance-summary"><span><strong>${rows.length}</strong> expected submissions</span><span><strong>${submitted}</strong> submitted</span><span><strong>${rows.filter((a) => a.status === "missing").length}</strong> missing</span><span><strong>${rows.filter((a) => a.overdue).length}</strong> overdue</span><span><strong>${rows.filter((a) => a.late).length}</strong> submitted late</span><span><strong>${rows.filter((a) => a.status === "approved").length}</strong> approved</span></div><p class="module-meta">Compliance: ${rows.length ? Math.round((submitted / rows.length) * 100) : 0}% submitted. Cancelled requirements and independent submissions are excluded.</p><div class="assignment-list">${
    rows
      .map((a) => {
        const r = data.requirements.find((r) => r.id === a.requirement_id);
        return `<div class="compliance-item"><strong>${esc(r.title)}</strong><p class="module-meta">Due ${esc(dueLabel(r.due_at))}</p>${assignmentRow(a, r)}</div>`;
      })
      .join("") || '<p class="muted">No assigned requirements.</p>'
  }</div></section>`;
}
function exportCompliance() {
  const rows = [
      [
        "Requirement",
        "Teacher",
        "Subject",
        "Grade",
        "Term",
        "School year",
        "Deadline UTC",
        "Status",
        "Submitted UTC",
        "Late submission",
        "Overdue",
      ],
      ...complianceRows().map((a) => {
        const r = data.requirements.find((r) => r.id === a.requirement_id);
        return [
          r.title,
          a.teacher,
          r.subject,
          r.grade,
          r.term,
          r.year,
          r.due_at,
          a.status,
          a.submitted_at,
          a.late ? "Yes" : "No",
          a.overdue ? "Yes" : "No",
        ];
      }),
    ],
    quote = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^(\s*)([=+@-])/, "'$1$2")
        .replace(/"/g, '""') +
      '"',
    url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(quote).join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "submission-compliance.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function workflowModuleDue(m) {
  const r = (data.requirements || []).find((r) => r.id === m.requirement_id);
  if (!r)
    return m.deadline
      ? `<div class="module-meta">Due ${date(m.deadline)}</div>`
      : "";
  const a = (data.assignments || []).find((a) => a.module_id === m.id);
  return `<div class="module-meta">${r.cancelled ? "Requirement cancelled" : "Due " + esc(dueLabel(r.due_at))}${a?.overdue ? " · Overdue" : ""}${a?.late ? " · Submitted late" : ""}</div>`;
}
function moduleRequirementDetails(m) {
  const r = (data.requirements || []).find((r) => r.id === m.requirement_id);
  return r
    ? `<div class="module-requirement"><strong>Requirement</strong><p>${esc(r.title)}</p>${workflowModuleDue(m)}<button class="link-btn" onclick="go('requirements')">View requirement</button></div>`
    : "";
}

const appearanceThemes = {
  slate: {
    label: "Slate",
    background: "#101720",
    accent: "#b7c7df",
    action: "#34475f",
    particles: [0.4, 0.49, 0.64],
    highlight: [0.82, 0.88, 0.98],
    waves: [0.09, 0.115, 0.16],
  },
  ocean: {
    label: "Ocean",
    background: "#0a1722",
    accent: "#a6cbdc",
    action: "#2e5b72",
    particles: [0.4, 0.64, 0.78],
    highlight: [0.79, 0.93, 0.98],
    waves: [0.04, 0.15, 0.22],
  },
  forest: {
    label: "Forest",
    background: "#111d19",
    accent: "#b8cdbd",
    action: "#426051",
    particles: [0.48, 0.64, 0.53],
    highlight: [0.85, 0.95, 0.88],
    waves: [0.07, 0.15, 0.11],
  },
  warm: {
    label: "Warm",
    background: "#211c17",
    accent: "#d9c6ac",
    action: "#6d5944",
    particles: [0.7, 0.58, 0.43],
    highlight: [0.98, 0.91, 0.8],
    waves: [0.15, 0.105, 0.065],
  },
};
let appearanceChoice = "slate";
try {
  const saved = localStorage.getItem("sikap-appearance");
  if (appearanceThemes[saved]) appearanceChoice = saved;
} catch {}
function setAppearance(key, persist = true) {
  if (!appearanceThemes[key]) return;
  appearanceChoice = key;
  const theme = appearanceThemes[key];
  const style = document.documentElement?.style;
  style?.setProperty("--sikap-bg", theme.background);
  style?.setProperty("--sikap-accent", theme.accent);
  style?.setProperty("--sikap-action", theme.action);
  if (persist) {
    try {
      localStorage.setItem("sikap-appearance", key);
    } catch {}
  }
  document
    .querySelectorAll?.('input[name="sikap-appearance"]')
    .forEach((input) => {
      input.checked = input.value === key;
    });
  if (
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  )
    window.dispatchEvent(
      new CustomEvent("sikap-appearance", { detail: theme }),
    );
}
function appearanceControls(compact = false) {
  return `<fieldset class="appearance-choices ${compact ? "appearance-compact" : ""}"><legend>${compact ? '<span class="material-symbols-rounded" aria-hidden="true">palette</span><span class="appearance-name">Choose color</span>' : "Color"}</legend>${Object.entries(
    appearanceThemes,
  )
    .map(
      ([key, theme]) =>
        `<label class="appearance-choice" title="${theme.label}"><input type="radio" name="sikap-appearance" value="${key}" ${appearanceChoice === key ? "checked" : ""} onchange="setAppearance(this.value)" aria-label="${theme.label}"><span class="appearance-swatch" style="--swatch:${theme.accent}" aria-hidden="true"></span><span class="appearance-name">${theme.label}</span></label>`,
    )
    .join("")}</fieldset>`;
}
function appearanceMenu() {
  return `<details class="appearance-menu"><summary class="icon-btn" aria-label="Choose color">${ico("palette")}</summary><div class="appearance-popover">${appearanceControls()}</div></details>`;
}
window.sikapAppearance = () => appearanceThemes[appearanceChoice];
setAppearance(appearanceChoice, false);

function login(error = "") {
  $("#app").innerHTML =
    `<main class="book-landing ${authMode === "register" ? "book-register" : ""}">
    <div class="book-stage">
      <div class="book-art" aria-hidden="true"></div>
      <canvas class="book-dust" aria-hidden="true"></canvas>
      <section class="book-left" aria-label="Project Sikap introduction"><div class="book-wordmark">${ico("auto_stories")}<span>PROJECT SIKAP</span></div></section>
      <section class="book-right" aria-label="School account"><div id="book-form-slot">${bookAuthForm(error)}</div></section>
    </div><div class="landing-appearance">${appearanceMenu()}</div>
  </main>`;
}
function bookAuthForm(error = "") {
  const setup = authMode === "register";
  return `<form class="school-login book-form ${setup ? "book-signup" : ""}" onsubmit="schoolLogin(event)" aria-label="${setup ? "Create an account" : "Sign in to Project Sikap"}">
    <h1>${setup ? "Create account" : "Sign in"}</h1>
    ${setup ? '<div class="field"><label for="register-name">Full name</label><input id="register-name" name="name" autocomplete="name" placeholder="Enter your name" maxlength="120" required></div>' : ""}
    <div class="field"><label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="Enter your email" required></div>
    <div class="field"><label for="login-password">Password</label><div class="input-wrap"><input id="login-password" name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" ${setup ? 'minlength="12"' : ""} maxlength="200" placeholder="${setup ? "At least 12 characters" : "Enter your password"}" required><button class="password-toggle" type="button" onclick="togglePassword()" aria-label="Show password">${ico("visibility")}</button></div></div>
    ${setup ? '<div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm" type="password" autocomplete="new-password" placeholder="Re-enter your password" minlength="12" maxlength="200" required></div>' : ""}
    <div class="login-options"><label><input name="remember" type="checkbox">Remember me</label>${!setup ? '<button type="button" class="link-btn" onclick="passwordHelp()">Forgot password?</button>' : ""}</div>
    <p class="form-error" role="alert">${esc(error || googleError())}</p>
    <button class="primary login-submit" type="submit">${setup ? "Sign Up" : "Sign in"}</button>
    <div class="login-footer"><button type="button" class="link-btn" onclick="setAuthMode('${setup ? "login" : "register"}')">${setup ? "Sign In" : "Create an account"}</button></div>
  </form>`;
}
function setAuthMode(mode) {
  if (busy) return;
  authMode = mode;
  const slot = $("#book-form-slot");
  if (!slot) {
    login();
    return;
  }
  const landing = $(".book-landing");
  landing.classList.toggle("book-register", mode === "register");
  slot.innerHTML = bookAuthForm();
  slot.classList.remove("book-page-turn");
  void slot.offsetWidth;
  slot.classList.add("book-page-turn");
}
function googleError() {
  const code = new URLSearchParams(location.search).get("auth_error");
  return (
    {
      google_setup:
        "Google sign-in is not configured yet. Ask the workspace owner to connect it.",
      google_failed: "Google sign-in could not be completed. Please try again.",
      google_cancelled: "Google sign-in was cancelled.",
      google_link_required:
        "This email already has a school login. Sign in with your password, then link Google from Profile.",
    }[code] || ""
  );
}
async function googleSignIn(link = false) {
  try {
    await window.sikapBackend.google(link);
  } catch (e) {
    const error = $(".school-login .form-error");
    if (error) error.textContent = e.message;
    else toast(e.message);
  }
}
function togglePassword() {
  const input = $("#login-password"),
    button = $(".password-toggle"),
    show = input.type === "password";
  input.type = show ? "text" : "password";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  button.innerHTML = ico(show ? "visibility_off" : "visibility");
}
async function passwordHelp() {
  const email = $("#login-email").value.trim();
  if (!email) {
    $(".form-error").textContent = "Enter your email above first.";
    $("#login-email").focus();
    return;
  }
  try {
    await window.sikapBackend.reset(email);
    $(".form-error").textContent =
      "If the account exists, a reset link will arrive by email.";
  } catch (e) {
    $(".form-error").textContent = e.message;
  }
}
async function resendConfirmation() {
  const email = $("#login-email"),
    error = $(".school-login .form-error");
  if (!email.reportValidity() || !email.value.trim()) {
    error.textContent = "Enter your registered email first.";
    email.focus();
    return;
  }
  if (busy) return;
  busy = true;
  try {
    await api("auth/resend", {
      method: "POST",
      body: JSON.stringify({ email: email.value.trim() }),
    });
    error.textContent =
      "If your account needs confirmation, a new link will arrive by email. Check Spam too.";
  } catch (e) {
    error.textContent = e.message;
  } finally {
    busy = false;
  }
}
async function schoolLogin(e) {
  e.preventDefault();
  if (busy) return;
  const form = e.target,
    f = new FormData(form),
    button = form.querySelector('button[type="submit"]'),
    error = form.querySelector(".form-error");
  error.textContent = "";
  if (authMode === "register" && f.get("password") !== f.get("confirm")) {
    error.textContent = "The passwords do not match.";
    return;
  }
  busy = true;
  button.disabled = true;
  const old = button.textContent;
  button.textContent =
    authMode === "register" ? "Creating account…" : "Signing in…";
  try {
    const result = await api(
      "auth/" + (authMode === "register" ? "register" : "login"),
      {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          remember: f.has("remember"),
        }),
      },
    );
    if (result.needsConfirmation) {
      error.textContent =
        "Account created. Check your email to confirm your account, then sign in.";
      return;
    }
    view = "dashboard";
    await load();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = old;
  }
}
async function logout() {
  if (dirty && !confirm("Discard your unsaved changes and sign out?")) return;
  try {
    await api("auth/logout", { method: "POST", body: "{}" });
    data = null;
    detail = null;
    dirty = false;
    view = "dashboard";
    authMode = "login";
    await load();
    toast("You have been logged out.");
  } catch (e) {
    toast(e.message);
  }
}
async function load() {
  try {
    await window.sikapBackend.ready();
    if (window.sikapBackend.recovery) {
      resetPage();
      return;
    }
    data = await api("state");
    render();
  } catch (e) {
    if (e.status === 503 && e.message.includes("config.js")) {
      authContext = {};
      login(e.message);
      return;
    }
    if (e.status === 401) {
      try {
        authContext = await api("auth/context");
      } catch {
        authContext = null;
      }
      login();
    } else
      $("#app").innerHTML =
        `<main class="centered-login"><section class="login-card centered-card"><h1>Project Sikap</h1><p role="alert">${esc(e.message)}</p><button class="primary" onclick="load()">Try again</button></section></main>`;
  }
}

function resetPage() {
  $("#app").innerHTML =
    '<main class="centered-login clean-login"><form class="login-card centered-card school-login" onsubmit="resetPassword(event)"><div class="clean-brand">Project Sikap</div><h1 class="signup-heading">Set a new password</h1><div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></div><div class="field"><label for="repeat-password">Confirm password</label><input id="repeat-password" name="confirm" type="password" minlength="12" autocomplete="new-password" required></div><p class="form-error" role="alert"></p><button class="primary login-submit" type="submit">Update password</button></form></main>';
}
async function resetPassword(e) {
  e.preventDefault();
  const f = new FormData(e.target),
    button = e.target.querySelector("button");
  if (f.get("password") !== f.get("confirm")) {
    e.target.querySelector(".form-error").textContent =
      "Passwords do not match.";
    return;
  }
  button.disabled = true;
  try {
    await window.sikapBackend.updatePassword(f.get("password"));
    history.replaceState(null, "", location.pathname);
    await load();
    toast("Password updated.");
  } catch (error) {
    e.target.querySelector(".form-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function avatarContent(u) {
  return u.avatarUrl
    ? `<img src="${esc(u.avatarUrl)}" alt="${esc(u.name)} profile picture" referrerpolicy="no-referrer">`
    : esc(
        u.name
          .trim()
          .split(/\s+/)
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      );
}
async function uploadProfilePhoto(e) {
  if (busy) return;
  const file = e.target.files[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2097152
  ) {
    toast("Choose a JPG, PNG or WebP image up to 2 MB.");
    e.target.value = "";
    return;
  }
  if (dirty && !confirm("Discard unsaved profile changes?")) return;
  busy = true;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob)
      throw Error("This image could not be processed. Choose another file.");
    const body = new FormData();
    body.set("file", new File([blob], "profile.jpg", { type: "image/jpeg" }));
    await api("profile/photo", { method: "POST", body });
    data = await api("state");
    dirty = false;
    render();
    toast("Profile picture updated.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
    e.target.value = "";
  }
}
async function removeProfilePhoto() {
  if (busy) return;
  if (dirty && !confirm("Discard unsaved profile changes?")) return;
  busy = true;
  try {
    await api("profile/photo", { method: "DELETE" });
    data = await api("state");
    dirty = false;
    render();
    toast("Profile picture removed.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
  }
}
function profilePage() {
  const u = data.user,
    initials = u.name
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    grades = [
      "Kindergarten",
      ...Array.from({ length: 12 }, (_, i) => "Grade " + (i + 1)),
    ];
  return `<div class="profile-layout"><section class="profile-banner"><div class="profile-photo-controls"><div class="profile-avatar">${avatarContent(u)}</div><label class="photo-upload">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadProfilePhoto(event)" aria-label="Choose profile picture"></label>${u.avatar_key ? '<button class="link-btn" onclick="removeProfilePhoto()">Remove photo</button>' : ""}</div><div class="profile-identity"><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p><span class="profile-role">${ico(u.role === "head" ? "verified_user" : "school")}${u.role === "head" ? "Head Teacher" : "Teacher"}</span></div></section><form class="panel profile-form" onsubmit="saveProfile(event)"><div class="profile-section-title">${ico("person")}<div><h2>Personal details</h2><p>Your name appears on submissions and reviews.</p></div></div><div class="form-grid">${field("name", "Full name", `<input id="name" name="name" value="${esc(u.name)}" required maxlength="120" autocomplete="name">`)}${field("email", "Email", `<input id="email" value="${esc(u.email)}" readonly>`)}</div><div class="profile-section-title teaching-title">${ico("auto_stories")}<div><h2>Teaching details</h2><p>Keep your teaching assignment up to date.</p></div></div><div class="field"><label for="assignment">Department</label><input id="assignment" name="assignment" value="${esc(u.assignment)}" maxlength="120" placeholder="e.g. Mathematics Department"></div><fieldset class="profile-choices"><legend>Subjects handled</legend><div class="choice-grid">${subjects.map((subject) => `<label class="choice-chip"><input type="checkbox" name="subjects" value="${esc(subject)}" ${(u.subjects || []).includes(subject) ? "checked" : ""}><span>${esc(subject)}</span></label>`).join("")}</div></fieldset><fieldset class="profile-choices"><legend>Grade levels</legend><div class="choice-grid grades">${grades.map((grade) => `<label class="choice-chip"><input type="checkbox" name="grade_levels" value="${grade}" ${(u.grade_levels || []).includes(grade) ? "checked" : ""}><span>${grade}</span></label>`).join("")}</div></fieldset><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Save profile</button></div></form></div>`;
}
async function saveProfile(e) {
  await formSave(e, async (form) => {
    const f = new FormData(form);
    await api("profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: f.get("name").trim(),
        assignment: f.get("assignment").trim(),
        subjects: f.getAll("subjects"),
        grade_levels: f.getAll("grade_levels"),
      }),
    });
    toast("Profile saved.");
  });
}

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
  return `<section class="workspace-hero"><div class="workspace-hero-copy"><span class="workspace-role">${head ? "Head Teacher" : "Teacher"}</span><h2>${head ? "Review queue" : "Your modules"}</h2><p>${head ? (pending ? pending + " submission" + (pending === 1 ? "" : "s") + " awaiting review." : "No submissions awaiting review.") : returned ? returned + " module" + (returned === 1 ? "" : "s") + " need" + (returned === 1 ? "s" : "") + " revision." : "No revisions requested."}</p><div class="workspace-actions">${actions.map(([route, label, count], i) => `<button class="${i === 0 ? "workspace-action-primary" : ""}" aria-label="${label}" title="${label}" onclick="go('${route}')">${label}${count !== null ? `<span>${count}</span>` : ico("north_east")}</button>`).join("")}</div></div><div id="head-desk" data-desk-role="${head ? "head" : "teacher"}" class="workspace-desk" aria-label="School desk"><div class="real-desk-art" aria-hidden="true"></div></div></section>`;
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

function noteActions(n) {
  return `<button class="action-btn" onclick="pinNote('${n.id}')">${n.pinned ? "Unpin" : "Pin"}</button><button class="action-btn" onclick="noteModal('${n.id}')">Edit</button><button class="action-btn" onclick="deleteNote('${n.id}')">Delete</button>`;
}
function notesPage() {
  return `<div class="toolbar"><p class="muted">Your private notes</p><button class="primary" onclick="noteModal()">New note</button></div><div class="cards notes-grid">${data.notes.map((n) => `<article class="panel note-panel" tabindex="0"><div class="note-top"><h3>${esc(n.title)}</h3>${n.pinned ? '<span class="pin">Pinned</span>' : ""}<details class="mobile-more note-more"><summary aria-label="Actions for ${esc(n.title)}">${ico("more_horiz")}</summary><div class="more-actions">${noteActions(n)}</div></details></div><p class="note-body">${esc(n.body)}</p><div class="note-actions desktop-note-actions">${noteActions(n)}</div></article>`).join("") || '<div class="panel empty"><h3>No notes yet</h3><p>Create a note to keep your checklist or lesson ideas nearby.</p></div>'}</div>`;
}
function noteModal(nid) {
  const n = data.notes.find((n) => n.id === nid);
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="note-title"><div class="modal-head"><h2 id="note-title">${n ? "Edit note" : "New note"}</h2><button class="close" onclick="closeModal()" aria-label="Close">×</button></div><form onsubmit="saveNote(event,'${nid || ""}')"><div class="field"><label for="note-name">Title</label><input id="note-name" name="title" value="${esc(n?.title)}" maxlength="160" required></div><div class="field"><label for="note-body">Note</label><textarea id="note-body" name="body" maxlength="5000" required>${esc(n?.body)}</textarea></div><label class="checkbox-label"><input name="pinned" type="checkbox" ${n?.pinned ? "checked" : ""}> Pin this note</label><p class="form-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save note</button></div></form></section>`;
  $("#note-name").focus();
}
function closeModal() {
  const root = $("#modalRoot");
  if (
    root?.querySelector("form") &&
    dirty &&
    !confirm("Discard your unsaved changes?")
  )
    return;
  if (root) {
    root.innerHTML = "";
    dirty = false;
  }
}
async function saveNote(e, nid) {
  await formSave(e, async (form) => {
    const f = new FormData(form);
    await api(nid ? "notes/" + nid : "notes", {
      method: nid ? "PATCH" : "POST",
      body: JSON.stringify({
        title: f.get("title"),
        body: f.get("body"),
        pinned: f.has("pinned"),
      }),
    });
    toast("Note saved.");
  });
}
async function pinNote(nid) {
  try {
    const n = data.notes.find((n) => n.id === nid);
    await api("notes/" + nid, {
      method: "PATCH",
      body: JSON.stringify({ ...n, pinned: !n.pinned }),
    });
    data = await api("state");
    render();
  } catch (e) {
    toast(e.message);
  }
}
async function deleteNote(nid) {
  if (!confirm("Delete this note? This cannot be undone.")) return;
  try {
    await api("notes/" + nid, { method: "DELETE" });
    data = await api("state");
    render();
    toast("Note deleted.");
  } catch (e) {
    toast(e.message);
  }
}
function notificationsPage() {
  const unread = data.notifications.some((n) => !n.read);
  return `<div class="panel"><div class="panel-head"><h2>Notifications</h2><button class="secondary" onclick="markNotificationsRead()" ${unread ? "" : "disabled"}>Mark all as read</button></div><div class="module-list">${data.notifications.map((n) => `<button class="module-row notification-row" onclick="openNotification('${n.id}')"><span>${!n.read ? "<strong>Unread</strong> · " : ""}${esc(n.body)}<small class="module-meta">${date(n.created)}</small></span>${ico("chevron_right")}</button>`).join("") || '<div class="empty">No notifications yet.</div>'}</div></div>`;
}
async function markNotificationsRead() {
  if (busy) return;
  busy = true;
  try {
    await api("notifications", { method: "PATCH", body: "{}" });
    data = await api("state");
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
async function openNotification(nid) {
  const n = data.notifications.find((n) => n.id === nid);
  if (n?.module) await openModule(n.module);
  else if (n?.requirement_id) await go("requirements");
}

function reportsPage() {
  const list = filtered(),
    approved = list.filter((m) => m.status === "approved").length,
    returned = list.filter((m) => m.status === "returned").length,
    pending = list.filter((m) => m.status === "pending").length;
  return `${complianceReport()}${filterPanel()}<div class="toolbar"><p class="muted">Report for the current filters · ${list.length} modules</p><button class="secondary" onclick="exportReport()">Export CSV</button></div><div class="cards">${stat("Approval rate", list.length ? Math.round((approved / list.length) * 100) + "%" : "0%", "#e4f3e9")}${stat("Pending review", pending, "#fff3cf")}${stat("Needs revision", returned, "#f9e7ea")}${stat("Submitting teachers", new Set(list.map((m) => m.owner)).size, "#efecf9")}</div><div class="panel activity-panel"><h2>Submission activity</h2>${activity(data.events.filter((e) => list.some((m) => m.id === e.module)))}</div>`;
}
function exportReport() {
  const quote = (s) =>
      '"' +
      String(s ?? "")
        .replace(/^(\s*)([=+@-])/, "'$1$2")
        .replace(/"/g, '""') +
      '"',
    rows = [
      [
        "Title",
        "Teacher",
        "Subject",
        "Grade",
        "Term",
        "School year",
        "Status",
        "Version",
        "Submitted",
        "Approved on",
      ],
      ...filtered().map((m) => [
        m.title,
        m.teacher,
        m.subject,
        m.grade,
        m.term,
        m.year,
        label(m.status),
        m.version,
        m.created,
        m.approved,
      ]),
    ],
    blob = new Blob([rows.map((r) => r.map(quote).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "project-sikap-report.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ico = (s) =>
  `<span class="material-symbols-rounded" aria-hidden="true">${s}</span>`;
const label = (s) =>
  ({
    pending: "Pending review",
    returned: "Needs revision",
    approved: "Approved",
  })[s];
const date = (s) =>
  s
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00" : s,
      ).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const size = (n) =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " KB";
let data = null,
  view = "dashboard",
  detail = null,
  busy = false,
  width = Number(localStorage.getItem("sikap-sidebar-width") || 238);
let authContext = null,
  authMode = "login",
  dirty = false;
let filters = {
  subject: "all",
  grade: "all",
  term: "all",
  year: "all",
  status: "all",
  search: "",
  sort: "updated",
};
const subjects = [
  "Mathematics",
  "Science",
  "English",
  "Filipino",
  "Social Studies",
  "Health",
  "MAPEH",
  "Technology and Livelihood Education",
];
const titles = {
  dashboard: "Dashboard",
  requirements: "Requirements",
  modules: "My modules",
  library: "Approved modules",
  reviews: "Pending reviews",
  submit: "Submit a module",
  notes: "My notes",
  notifications: "Notifications",
  teachers: "Teachers",
  reports: "Reports",
  profile: "Profile",
  review: "Module details",
  starred: "Starred modules",
};
async function api(path, options = {}) {
  return window.sikapBackend.api(path, options);
}
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3500);
}
async function go(next) {
  if (busy) return;
  if (dirty && !confirm("Discard your unsaved changes?")) return;
  busy = true;
  try {
    const fresh = await api("state");
    data = fresh;
    if (next === "archive" || (next === "submit" && data.user.role === "head"))
      next = "dashboard";
    view = next;
    dirty = false;
    detail = null;
    filterOpen = false;
    filterDraft = null;
    render();
    window.scrollTo(0, 0);
  } catch (e) {
    if (e.status === 401) await load();
    else toast("Could not refresh this page. " + e.message);
  } finally {
    busy = false;
  }
}

function badge(s) {
  return `<span class="badge ${s}">${label(s)}</span>`;
}
function navItem(key, icon, text, count = 0) {
  return `<button class="${view === key ? "active" : ""}" aria-label="${key === "submit" ? "Submit module" : text}" title="${key === "submit" ? "Submit module" : text}" onclick="go('${key}')"><span class="nav-ico">${ico(icon)}</span><span class="nav-label">${text}</span>${count ? `<span class="nav-count">${count}</span>` : ""}</button>`;
}
function render() {
  if (!data) return;
  const u = data.user,
    head = u.role === "head",
    active = data.modules.filter((m) => !m.archived),
    unread = data.notifications.filter((n) => !n.read).length;
  $("#app").innerHTML =
    `<div class="app" style="--sidebar-width:${width}px"><aside class="sidebar" id="side"><div class="workspace-brand"><span class="brand-symbol">${ico("auto_stories")}</span><div>Project Sikap</div></div><button class="profile-head" onclick="go('profile')" aria-label="Open profile"><div class="avatar">${avatarContent(u)}</div><div><strong>${esc(u.name)}</strong><small>${head ? "Head teacher" : "Teacher"}${u.assignment ? " · " + esc(u.assignment) : ""}</small></div>${ico("chevron_right")}</button><nav class="nav">${navItem("dashboard", "space_dashboard", "Dashboard")}${navItem("requirements", "event_note", "Requirements")}${!head ? navItem("submit", "upload_file", "Submit module") : ""}${navItem("modules", "folder_open", head ? "All modules" : "My modules", active.length)}${head ? navItem("reviews", "fact_check", "Pending reviews", active.filter((m) => m.status === "pending").length) : ""}${navItem("library", "verified", "Approved modules")}${navItem("starred", "star", "Starred")}${navItem("notes", "edit_note", "My notes", data.notes.length)}${navItem("notifications", "notifications", "Notifications", unread)}${head ? navItem("teachers", "group", "Teachers", data.teachers.filter((u) => u.approval_status === "pending").length) + navItem("reports", "analytics", "Reports") : ""}</nav><button class="logout-btn" onclick="logout()">${ico("logout")}<span>Log out</span></button><div class="sidebar-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" onpointerdown="resizeSide(event)"></div></aside><div class="overlay" id="overlay" onclick="menu()"></div><main class="main"><header class="topbar"><div class="page-heading"><button class="icon-btn mobile-menu" onclick="menu()" aria-label="Open menu">${ico("menu")}</button><h1>${view === "modules" && head ? "All modules" : titles[view]}</h1></div><div class="top-actions">${appearanceMenu()}<button class="icon-btn" onclick="go('notifications')" aria-label="Notifications">${ico("notifications")}${unread ? '<span class="unread"></span>' : ""}</button>${!head && view !== "submit" ? '<button class="primary submit-plus" aria-label="Submit module" title="Submit module" onclick="go(\'submit\')">+</button>' : ""}</div></header><section class="content">${page()}</section></main></div><div id="modalRoot"></div>`;
}
function menu() {
  $("#side").classList.toggle("open");
  $("#overlay").classList.toggle("show");
}
function resizeSide(e) {
  if (innerWidth <= 760) return;
  e.preventDefault();
  document.body.classList.add("resizing-sidebar");
  const move = (e) => {
    width = Math.max(210, Math.min(360, e.clientX - 8));
    $(".app").style.setProperty("--sidebar-width", width + "px");
  };
  const stop = () => {
    localStorage.setItem("sikap-sidebar-width", width);
    document.body.classList.remove("resizing-sidebar");
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", stop);
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", stop);
}
let filterOpen = false,
  filterDraft = null;
function defaultFilters() {
  return {
    subject: "all",
    grade: "all",
    term: "all",
    year: "all",
    status: "all",
    search: "",
    sort: "updated",
  };
}
function editingFilters() {
  return filterOpen ? filterDraft : filters;
}
function filterDropdown(key, title, options) {
  const current = editingFilters(),
    selected = options.find((o) => o.value === current[key]) || options[0];
  return `<div class="academic-filter"><span id="filter-label-${key}" class="filter-label">${title}</span><details class="filter-dropdown" data-filter-key="${key}" ontoggle="filterDropdownToggle(this)"><summary id="filter-${key}" aria-labelledby="filter-label-${key} filter-value-${key}"><span id="filter-value-${key}">${esc(selected.text)}</span>${ico("expand_more")}</summary><div class="filter-dropdown-options" aria-label="${title}" onkeydown="filterDropdownKeys(event)">${options.map((o) => `<button type="button" data-value="${esc(o.value)}" aria-pressed="${current[key] === o.value}" onclick="chooseFilter(this)"><span>${esc(o.text)}</span>${current[key] === o.value ? ico("check") : ""}</button>`).join("")}</div></details></div>`;
}
function select(key, title, values) {
  return filterDropdown(key, title, [
    {
      value: "all",
      text: `All ${key === "grade" ? "grades" : key === "year" ? "school years" : key === "term" ? "terms" : "subjects"}`,
    },
    ...values.map((value) => ({ value, text: value })),
  ]);
}
function filterDropdownToggle(el) {
  if (el.open)
    document.querySelectorAll(".filter-dropdown[open]").forEach((other) => {
      if (other !== el) other.open = false;
    });
}
function filterDropdownKeys(e) {
  const menu = e.currentTarget,
    buttons = [...menu.querySelectorAll("button")],
    index = buttons.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    buttons[
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length
    ]?.focus();
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    const dropdown = menu.closest("details");
    dropdown.open = false;
    dropdown.querySelector("summary").focus();
  }
}
function chooseFilter(button) {
  const dropdown = button.closest("details"),
    key = dropdown.dataset.filterKey,
    value = button.dataset.value;
  setFilter(key, value);
  if (dropdown.isConnected) {
    dropdown.querySelector("summary span").textContent =
      button.querySelector("span").textContent;
    dropdown.querySelectorAll("button").forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
      option.querySelector(".material-symbols-rounded")?.remove();
    });
    button.insertAdjacentHTML("beforeend", ico("check"));
    dropdown.open = false;
    dropdown.querySelector("summary").focus();
  } else $("#filter-" + key)?.focus();
}
function filterPanel() {
  const current = editingFilters(),
    active = data.modules.filter((m) =>
      view === "archive" ? m.archived : !m.archived,
    ),
    count =
      ["subject", "grade", "term", "year", "status"].filter(
        (k) => filters[k] !== "all",
      ).length +
      (filters.search.trim() ? 1 : 0) +
      (filters.sort !== "updated" ? 1 : 0);
  const unique = (k) =>
    [...new Set(active.map((m) => m[k]))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  return `<div class="filter-shell ${filterOpen ? "is-open" : ""}"><div class="mobile-filter-bar"><span class="filter-caption">${count ? `${count} active filter${count === 1 ? "" : "s"}` : "All submissions"}</span><button id="mobile-filter-toggle" class="icon-btn mobile-filter-toggle" aria-label="Filters${count ? `, ${count} active` : ""}" title="Filters" aria-expanded="${filterOpen}" aria-controls="workspace-filter-panel" onclick="toggleFilters()">${ico("tune")}<span>Filters</span>${ico("expand_more")}${count ? `<span class="filter-count">${count}</span>` : ""}</button></div><div id="workspace-filter-panel" class="academic-filters workspace-filters" role="region" aria-label="Module filters"><div class="mobile-filter-heading"><h3>Filters</h3><button class="icon-btn" aria-label="Close filters" onclick="closeFilters()">${ico("close")}</button></div><div class="academic-filter search-filter"><label for="search">Search modules</label><input id="search" placeholder="Title or teacher name" value="${esc(current.search)}" oninput="searchModules(this.value)"></div>${select("subject", "Subject", unique("subject"))}${select("grade", "Grade / Year level", unique("grade"))}${select("term", "Quarter / Semester", unique("term"))}${select("year", "School year", unique("year"))}${filterDropdown("status", "Status", [{ value: "all", text: "All statuses" }, ...["pending", "approved", "returned"].map((value) => ({ value, text: label(value) }))])}${filterDropdown(
    "sort",
    "Sort by",
    [
      { value: "updated", text: "Last updated" },
      { value: "oldest", text: "Oldest submission" },
      { value: "title", text: "Module title" },
    ],
  )}<button class="filter-clear desktop-filter-reset" onclick="clearFilters()">Reset filters</button><div class="mobile-filter-actions"><button class="secondary" onclick="clearFilters()">Reset</button><button class="primary" onclick="applyFilters()">Apply filters</button></div></div></div>`;
}
function toggleFilters() {
  if (filterOpen) {
    closeFilters();
    return;
  }
  filterDraft = { ...filters };
  filterOpen = true;
  render();
  $("#filter-subject")?.focus();
}
function closeFilters() {
  filterOpen = false;
  filterDraft = null;
  render();
  $("#mobile-filter-toggle")?.focus();
}
function applyFilters() {
  if (filterDraft) filters = { ...filterDraft };
  closeFilters();
}
function setFilter(key, value) {
  if (filterOpen) {
    filterDraft[key] = value;
    return;
  }
  filters[key] = value;
  render();
}
function clearFilters() {
  filters = defaultFilters();
  filterOpen = false;
  filterDraft = null;
  render();
  $("#mobile-filter-toggle")?.focus();
}
function searchModules(value) {
  if (filterOpen) {
    filterDraft.search = value;
    return;
  }
  filters.search = value;
  const result = $("#module-results");
  if (result) result.innerHTML = moduleResults();
  else render();
}
function filtered() {
  let list = data.modules.filter((m) =>
    view === "archive" ? m.archived : !m.archived,
  );
  if (view === "library") list = list.filter((m) => m.status === "approved");
  if (view === "reviews") list = list.filter((m) => m.status === "pending");
  if (view === "starred") list = list.filter((m) => m.starred);
  list = list.filter(
    (m) =>
      ["subject", "grade", "term", "year"].every(
        (k) => filters[k] === "all" || m[k] === filters[k],
      ) &&
      (filters.status === "all" || m.status === filters.status) &&
      `${m.title} ${m.teacher}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()),
  );
  return list.sort((a, b) =>
    filters.sort === "title"
      ? a.title.localeCompare(b.title)
      : filters.sort === "oldest"
        ? a.created.localeCompare(b.created)
        : b.updated.localeCompare(a.updated),
  );
}
function stat(title, n, tint) {
  const icon =
    {
      "Total modules": "folder_open",
      "Pending review": "schedule",
      Approved: "task_alt",
      "Needs revision": "edit_note",
      "Approval rate": "donut_large",
      "Submitting teachers": "groups",
    }[title] || "description";
  return `<div class="stat" style="--tint:${tint}"><div class="stat-icon">${ico(icon)}</div><div class="stat-copy"><div class="label">${title}</div><div class="value">${n}</div></div></div>`;
}
function page() {
  if (["dashboard", "modules", "library", "reviews", "starred"].includes(view))
    return modulePage();
  return (
    {
      requirements: requirementsPage,
      submit: submitPage,
      review: reviewPage,
      notes: notesPage,
      notifications: notificationsPage,
      profile: profilePage,
      teachers: teachersPage,
      reports: reportsPage,
    }[view]?.() || ""
  );
}
const renderShell = render;
render = function () {
  if (data && data.user.approval_status !== "approved") {
    approvalPage();
    return;
  }
  renderShell();
  if (view === "review" && detail) {
    const v = detail.versions.find((v) => v.version === detail.module.version),
      target = $(".doc-preview");
    if (v?.type !== "application/pdf" && target && window.previewDocx) {
      target.innerHTML =
        '<div class="docx-text-wrap"><h3>Document text preview</h3><p class="module-meta">Download the DOCX for its original formatting and images.</p><div class="docx-text"></div></div>';
      window.previewDocx(
        fileUrl(detail.module, v.version),
        target.querySelector(".docx-text"),
      );
    }
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (filterOpen) closeFilters();
    else if ($("#modalRoot")) closeModal();
  }
});
document.addEventListener("click", (e) => {
  document.querySelectorAll(".filter-dropdown[open]").forEach((el) => {
    if (!el.contains(e.target)) el.open = false;
  });
  if (filterOpen && !e.target.closest(".filter-shell")) {
    filterOpen = false;
    filterDraft = null;
    const shell = $(".filter-shell");
    shell?.classList.remove("is-open");
    $("#mobile-filter-toggle")?.setAttribute("aria-expanded", "false");
  }
});

$("#app").innerHTML =
  '<main class="centered-login"><section class="login-card centered-card"><h1>Project Sikap</h1><p>Loading your workspace…</p></section></main>';
load();

document.addEventListener("input", (e) => {
  if (e.target.closest?.(".content form, #modalRoot form")) dirty = true;
});
document.addEventListener("change", (e) => {
  if (e.target.closest?.(".content form, #modalRoot form")) dirty = true;
});
addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const dialog = document.querySelector(".modal");
  if (!dialog) return;
  const items = [
    ...dialog.querySelectorAll(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
    ),
  ].filter((el) => el.getClientRects().length);
  const first = items[0],
    last = items.at(-1);
  if (!first) return;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
