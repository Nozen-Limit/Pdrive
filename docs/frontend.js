const workflowCriteria = {
  objectives: "Learning objectives",
  content: "Content accuracy",
  activities: "Learning activities",
  assessment: "Assessment and answer key",
};
let requirementChoice = "",
  requirementFilter = "active";
const dueLabel = (s) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function workflowUnavailable() {
  return '<div class="panel workflow-setup"><h2>School workflow setup required</h2><p>The administrator must apply the school workflow database update before requirements and review checklists can be used.</p></div>';
}
function requirementsPage() {
  if (!data.workflowReady) return workflowUnavailable();
  const head = data.user.role === "head",
    list = (data.requirements || []).filter(
      (r) =>
        requirementFilter === "all" ||
        (requirementFilter === "cancelled" ? r.cancelled : !r.cancelled),
    );
  return `<div class="toolbar"><div class="filters">${["active", "cancelled", "all"].map((k) => `<button class="filter ${requirementFilter === k ? "active" : ""}" onclick="requirementFilter='${k}';render()">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>${head ? '<button class="primary" onclick="requirementModal()">New requirement</button>' : ""}</div><div class="requirements-list">${
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
  white: {
    label: "White",
    background: "#f5f7fa",
    accent: "#ffffff",
    action: "#34475f",
    light: true,
    particles: [0.24, 0.32, 0.43],
    highlight: [0.4, 0.49, 0.6],
    waves: [0.15, 0.19, 0.25],
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
  document.documentElement?.setAttribute?.("data-sikap-theme", key);
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
  return `<fieldset aria-label="Color theme" class="appearance-choices ${compact ? "appearance-compact" : ""}"><legend>${compact ? '<span class="material-symbols-rounded" aria-hidden="true">palette</span><span class="appearance-name">Choose color</span>' : "Color"}</legend>${Object.entries(
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
      <section class="book-left" aria-label="Project Sikap introduction"><div class="book-wordmark">${ico("auto_stories")}<span class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></span></div></section>
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
    <p class="form-error" role="alert">${esc(error)}</p>
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
    const route = bankRoute();
    if (route && data.user.approval_status === "approved") {
      bank.filters = Object.fromEntries(
        [...route.entries()].filter(
          ([key]) => !["scope", "resource"].includes(key),
        ),
      );
      await bankNavigate(route.get("scope") || "shared", "", true);
      if (route.get("resource")) await bankOpen(route.get("resource"));
    } else render();
  } catch (e) {
    if (e.status === 503 && e.message.includes("config.js")) {
      login(e.message);
      return;
    }
    if (e.status === 401) {
      login();
    } else
      $("#app").innerHTML =
        `<main class="centered-login"><section class="login-card centered-card"><h1>Project Sikap</h1><p role="alert">${esc(e.message)}</p><button class="primary" onclick="load()">Try again</button></section></main>`;
  }
}

function resetPage() {
  $("#app").innerHTML =
    `<main class="book-landing book-recovery" data-waves-only><div class="book-stage"><canvas class="book-dust" aria-hidden="true"></canvas><form class="book-form recovery-form" onsubmit="resetPassword(event)" aria-label="Set a new password"><div class="book-wordmark">${ico("auto_stories")}<span class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></span></div><h1>Set a new password</h1><div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></div><div class="field"><label for="repeat-password">Confirm password</label><input id="repeat-password" name="confirm" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></div><p class="form-error" role="alert"></p><button class="primary login-submit" type="submit">Update password</button></form></div><div class="landing-appearance">${appearanceMenu()}</div></main>`;
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
    ? `<img src="${esc(u.avatarUrl)}" data-profile-id="${esc(u.id)}" alt="${esc(u.name)} profile picture" referrerpolicy="no-referrer" onerror="profilePhotoFailed(this)">`
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
function profilePhotoFailed(image) {
  if (!data?.user) return;
  const person = [data.user, ...(data.teachers || [])].find(
    (u) => u.id === image.dataset.profileId,
  );
  if (!person) return;
  delete person.avatarUrl;
  person.avatarError =
    "Your picture is saved, but the image could not load. Retry to renew its private link.";
  if (image.parentElement)
    image.parentElement.textContent = person.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  if (person.id === data.user.id && view === "profile") render();
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
    const saved = await api("profile/photo", { method: "POST", body });
    Object.assign(data.user, saved);
    dirty = false;
    render();
    try {
      const fresh = await api("state");
      if (!fresh.user.avatar_key && saved.avatar_key)
        Object.assign(fresh.user, saved);
      data = fresh;
    } catch {
      toast("Picture saved. Other profile details could not refresh.");
      return;
    }
    dirty = false;
    render();
    toast(data.user.avatarError || "Profile picture updated.");
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
function profileMultiSelect(name, title, options, selected = []) {
  const choices = [...new Set([...options, ...selected])];
  const text = selected.length
    ? selected.join(", ")
    : "Select " + title.toLowerCase();
  return `<fieldset class="profile-select-field"><legend>${title}</legend><details class="profile-multiselect" ontoggle="positionProfileChoices(this)"><summary><span class="profile-selection" aria-live="polite">${esc(text)}</span>${ico("expand_more")}</summary><div class="profile-select-options">${choices.map((value) => `<label><input type="checkbox" name="${name}" value="${esc(value)}" ${selected.includes(value) ? "checked" : ""} onchange="updateProfileSelections(this)"><span>${esc(value)}</span></label>`).join("")}<button type="button" class="secondary profile-select-done" onclick="closeProfileChoices(this)">Done</button></div></details></fieldset>`;
}
function positionProfileChoices(dropdown) {
  if (!dropdown.open) return;
  const bounds = dropdown.getBoundingClientRect();
  const viewport = window.visualViewport?.height || innerHeight;
  const below = viewport - bounds.bottom;
  const upward = below < 260 && bounds.top > below;
  dropdown.classList.toggle("opens-up", upward);
  dropdown.style.setProperty(
    "--profile-options-height",
    Math.max(120, Math.min(300, (upward ? bounds.top : below) - 16)) + "px",
  );
}
function updateProfileSelections(input) {
  const dropdown = input.closest(".profile-multiselect");
  const selected = [...dropdown.querySelectorAll("input:checked")].map(
    (item) => item.value,
  );
  dropdown.querySelector(".profile-selection").textContent = selected.length
    ? selected.join(", ")
    : "Select options";
}
function closeProfileChoices(button) {
  const dropdown = button.closest(".profile-multiselect");
  dropdown.open = false;
  dropdown.querySelector("summary").focus();
}
document.addEventListener("click", (event) => {
  document
    .querySelectorAll(".profile-multiselect[open]")
    .forEach((dropdown) => {
      if (!dropdown.contains(event.target)) dropdown.open = false;
    });
});
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key !== "Escape") return;
    const dropdown = event.target.closest?.(".profile-multiselect[open]");
    if (!dropdown) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dropdown.open = false;
    dropdown.querySelector("summary").focus();
  },
  true,
);
function profilePage() {
  const u = data.user,
    grades = [
      "Kindergarten",
      ...Array.from({ length: 12 }, (_, i) => "Grade " + (i + 1)),
    ];
  return `<div class="profile-layout"><section class="profile-banner"><div class="profile-photo-controls"><div class="profile-avatar">${avatarContent(u)}</div><label class="photo-upload">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadProfilePhoto(event)" aria-label="Choose profile picture"></label>${u.avatar_key ? '<button class="link-btn" onclick="removeProfilePhoto()">Remove photo</button>' : ""}</div><div class="profile-identity"><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p><span class="profile-role">${ico(u.role === "head" ? "verified_user" : "school")}${u.role === "head" ? "Head Teacher" : "Teacher"}</span></div>${u.avatarError ? `<p class="photo-error" role="alert">${esc(u.avatarError)} <button type="button" class="link-btn" onclick="load()">Retry</button></p>` : ""}</section><form class="panel profile-form" onsubmit="saveProfile(event)"><div class="profile-section-title">${ico("person")}<div><h2>Personal details</h2><p>Your name appears on submissions and reviews.</p></div></div><div class="form-grid">${field("name", "Full name", `<input id="name" name="name" value="${esc(u.name)}" required maxlength="120" autocomplete="name">`)}${field("email", "Email", `<input id="email" value="${esc(u.email)}" readonly>`)}${field("phone", "Phone number", `<input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value="${esc(u.phone || "")}">`)}${field("location", "Location", `<input id="location" name="location" autocomplete="address-level2" maxlength="200" value="${esc(u.location || "")}" placeholder="City or municipality">`)}</div><div class="field"><label for="assignment">Department</label><input id="assignment" name="assignment" value="${esc(u.assignment)}" maxlength="120" placeholder="e.g. Mathematics Department"></div><div class="profile-teaching-selects">${profileMultiSelect("subjects", "Subjects handled", subjects, u.subjects || [])}${profileMultiSelect("grade_levels", "Grade levels", grades, u.grade_levels || [])}</div><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Save profile</button></div></form></div>`;
}
async function saveProfile(e) {
  await formSave(e, async (form) => {
    const f = new FormData(form);
    await api("profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: f.get("name").trim(),
        assignment: f.get("assignment").trim(),
        phone: f.get("phone").trim(),
        location: f.get("location").trim(),
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
function modulePage() {
  return `${filterPanel()}${view === "library" ? '<p class="muted">Final approved versions, accessible to their submitting teacher and head teachers.</p>' : ""}<div class="panel" id="module-results">${moduleResults()}</div>`;
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

let overviewLayout = "board";
function overviewPage() {
  return `<nav class="bank-workspace-tabs" aria-label="Module status">${[
    ["all", "All modules", "folder_open"],
    ["pending", "Pending review", "schedule"],
    ["returned", "Revision needed", "change_circle"],
    ["approved", "Approved", "check_circle"],
  ]
    .map(
      ([key, title, icon]) =>
        `<button aria-current="${filters.status === key ? "page" : "false"}" onclick="overviewStatus('${key}')">${ico(icon)}${title}</button>`,
    )
    .join(
      "",
    )}</nav><div class="overview-toolbar"><div class="overview-search">${ico("search")}<input type="search" aria-label="Search modules" placeholder="Search modules" value="${esc(filters.search)}" oninput="overviewSearch(this.value)"></div><div class="bank-view-toggle" aria-label="Module view"><button class="icon-btn" aria-label="Board view" aria-pressed="${overviewLayout === "board"}" onclick="overviewView('board')">${ico("view_kanban")}</button><button class="icon-btn" aria-label="List view" aria-pressed="${overviewLayout === "list"}" onclick="overviewView('list')">${ico("view_list")}</button></div></div>${filterPanel()}<div id="module-results">${overviewResults()}</div><div class="overview-support"><section><header><h2>${ico("assignment")}Requirements</h2><button class="bank-text-button" onclick="go('requirements')">Open requirements</button></header>${overviewRequirements()}</section><section><header><h2>${ico("description")}Pinned notes</h2><button class="bank-text-button" onclick="go('notes')">Manage notes</button></header>${
    data.notes
      .filter((note) => note.pinned)
      .slice(0, 3)
      .map(
        (note) =>
          `<article class="overview-note"><strong>${esc(note.title)}</strong><p>${esc(note.body)}</p></article>`,
      )
      .join("") || '<p class="overview-muted">No pinned notes.</p>'
  }</section><section><header><h2>${ico("history")}Recent activity</h2></header>${data.events.length ? activity(data.events.slice(0, 4)) : '<p class="overview-muted">No recent activity.</p>'}</section></div>`;
}
function overviewRequirements() {
  const assignments = (data.assignments || []).filter(
    (assignment) =>
      !(data.requirements || []).find(
        (requirement) => requirement.id === assignment.requirement_id,
      )?.cancelled,
  );
  if (!data.workflowReady)
    return '<p class="overview-muted">Requirements setup is needed.</p>';
  return `<div class="overview-requirement-counts"><span><strong>${assignments.filter((assignment) => assignment.status === "missing").length}</strong> Not submitted</span><span><strong>${assignments.filter((assignment) => assignment.status === "returned").length}</strong> Need revision</span><span><strong>${assignments.filter((assignment) => assignment.overdue).length}</strong> Overdue</span></div>`;
}
function overviewResults() {
  if (overviewLayout === "list") return moduleResults();
  const modules = filtered();
  return `<div class="bank-board overview-board" aria-label="Module board">${[
    ["pending", "Pending review", "schedule"],
    ["returned", "Revision needed", "change_circle"],
    ["approved", "Approved", "check_circle"],
  ]
    .map(([status, title, icon]) => {
      const items = modules.filter((module) => module.status === status);
      return `<section class="bank-board-column"><header><span class="bank-board-state bank-board-state-${status}">${ico(icon)}</span><h2>${title}</h2><span class="bank-board-count">${items.length}</span><span class="bank-board-column-space"></span><button class="bank-board-add" aria-label="Open ${title.toLowerCase()} modules" onclick="overviewOpenCollection('${status}')">${ico("open_in_new")}</button></header><div class="bank-board-stack">${items.map(overviewCard).join("") || '<div class="bank-board-empty">No modules</div>'}</div></section>`;
    })
    .join("")}</div>`;
}
function overviewCard(module) {
  const teacher = module.teacher || data.user.name;
  const initials = teacher
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return `<article class="bank-board-card"><div class="bank-board-card-top"><span>MODULE · v${module.version}</span><span class="bank-creator-mini" aria-label="Created by ${esc(teacher)}" title="${esc(teacher)}">${esc(initials)}</span></div><div class="bank-board-card-title">${ico(module.status === "approved" ? "check_circle" : "radio_button_unchecked")}<button onclick="openModule('${module.id}')">${esc(module.title)}</button></div><div class="bank-board-card-bottom"><span class="bank-type-mini">${ico("description")}</span><span class="bank-board-label">${esc(module.subject)}</span><span class="bank-board-label">${esc(module.grade)}</span><span class="bank-board-label">${esc(module.term)}</span><details class="bank-row-menu"><summary aria-label="Actions for ${esc(module.title)}">${ico("more_vert")}</summary><div><button onclick="openModule('${module.id}')">${ico("open_in_new")}Open module</button><button onclick="starModule('${module.id}')">${ico(module.starred ? "bookmark_remove" : "bookmark_add")}${module.starred ? "Remove from saved" : "Save module"}</button></div></details></div>${workflowModuleDue(module)}</article>`;
}
function overviewStatus(status) {
  filters.status = status;
  render();
}
function overviewView(layout) {
  overviewLayout = layout === "list" ? "list" : "board";
  render();
}
function overviewSearch(value) {
  filters.search = value;
  const target = $("#module-results");
  if (target) target.innerHTML = overviewResults();
}
async function overviewOpenCollection(status) {
  filters.status = status;
  await go(
    status === "approved"
      ? "library"
      : status === "pending" && data.user.role === "head"
        ? "reviews"
        : "modules",
  );
}
function overviewNew() {
  return `<details class="bank-new overview-new"><summary>${ico("add")}New</summary><div>${data.user.role === "teacher" ? `<button onclick="go('submit')">${ico("upload_file")}Submit module</button>` : ""}<button onclick="bankUploadPage()">${ico("upload_file")}Upload resource</button></div></details>`;
}

function noteActions(n) {
  return `<button class="action-btn" onclick="pinNote('${n.id}')">${n.pinned ? "Unpin" : "Pin"}</button><button class="action-btn" onclick="noteModal('${n.id}')">Edit</button><button class="action-btn" onclick="deleteNote('${n.id}')">Delete</button>`;
}
function notesPage() {
  return `<div class="toolbar"><button class="primary" onclick="noteModal()">New note</button></div><div class="cards notes-grid">${data.notes.map((n) => `<article class="panel note-panel" tabindex="0"><div class="note-top"><h3>${esc(n.title)}</h3>${n.pinned ? '<span class="pin">Pinned</span>' : ""}<details class="mobile-more note-more"><summary aria-label="Actions for ${esc(n.title)}">${ico("more_horiz")}</summary><div class="more-actions">${noteActions(n)}</div></details></div><p class="note-body">${esc(n.body)}</p><div class="note-actions desktop-note-actions">${noteActions(n)}</div></article>`).join("") || '<div class="panel empty"><h3>No notes yet</h3></div>'}</div>`;
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
  if (n?.module) {
    if (data.modules.some((module) => module.id === n.module))
      await openModule(n.module);
    else await bankOpen(n.module);
  } else if (n?.requirement_id) await go("requirements");
}

const bankCategories = {
  METHODS: "Teaching Methods",
  MODELS: "Strategic Innovations",
  UNITS: "Media Materials",
};
const bankStates = {
  draft: "Draft",
  pending: "Pending Review",
  returned: "Returned for Revision",
  resubmitted: "Resubmitted",
  approved: "Approved",
  archived: "Archived",
};
const bankScopes = {
  shared: "Digital Bank",
  mine: "My Resources",
  saved: "Saved Resources",
  recent: "Recently Approved",
  review: "Resource Review Queue",
  archived: "Archived Resources",
  all: "All Resources",
};
const bank = {
  scope: "shared",
  page: 1,
  layout: "list",
  boardHidden: ["approved"],
  theme: "white",
  screen: "list",
  filters: {},
  result: null,
  detail: null,
  loading: false,
  error: "",
  sequence: 0,
  stats: null,
  facets: { subjects: [], creators: [] },
  file: null,
  uploadKey: null,
  uploadId: null,
  editing: null,
  scroll: 0,
};
try {
  bank.theme = sessionStorage.getItem("sikap-bank-theme") || "white";
  if (!appearanceThemes[bank.theme]) bank.theme = "white";
  bank.layout = ["grid", "board"].includes(
    sessionStorage.getItem("sikap-bank-layout"),
  )
    ? sessionStorage.getItem("sikap-bank-layout")
    : "list";
} catch {
  /* Storage is optional. */
}
const bankApi = () => window.sikapBackend.bank;
function bankState(resource) {
  return (
    resource.state ||
    (resource.archived
      ? "archived"
      : resource.bank_draft
        ? "draft"
        : resource.status === "pending" && resource.version > 1
          ? "resubmitted"
          : resource.status)
  );
}
function bankBadge(resource) {
  const state = bankState(resource);
  return `<span class="bank-status bank-status-${state}">${bankStates[state] || state}</span>`;
}
function bankUrl(id) {
  if (typeof history === "undefined") return;
  const query = new URLSearchParams({ scope: bank.scope, ...bank.filters });
  if (id) query.set("resource", id);
  history.replaceState(
    null,
    "",
    "#bank=" + encodeURIComponent(query.toString()),
  );
}
function bankRoute() {
  if (typeof location === "undefined" || !location.hash.startsWith("#bank="))
    return null;
  try {
    return new URLSearchParams(decodeURIComponent(location.hash.slice(6)));
  } catch {
    return null;
  }
}
function bankMessage(error) {
  const message = error?.message || "The request could not be completed.";
  if (
    /setup|required|Choose|Enter|Complete|Refresh|Only|resource|revision|School account|Sign in|Upload|upload|File |file |before|checklist|feedback/i.test(
      message,
    ) &&
    !/column|relation|syntax|constraint|jwt|schema cache/i.test(message)
  )
    return message;
  return "The request could not be completed. Refresh and try again, or contact the administrator.";
}
function bankDialog(title, body, action, confirmText = "Continue") {
  return new Promise((resolve) => {
    bankResolveDialog = resolve;
    $("#modalRoot").innerHTML =
      `<div class="overlay show"></div><section class="modal bank-dialog" style="${bankThemeStyle()}" role="dialog" aria-modal="true" aria-labelledby="bank-dialog-title"><h2 id="bank-dialog-title">${esc(title)}</h2><p>${esc(body)}</p><div class="form-actions"><button class="secondary" onclick="bankAnswerDialog(false)">Cancel</button><button class="primary" onclick="bankAnswerDialog(true)">${esc(confirmText)}</button></div></section>`;
    $(".bank-dialog .secondary")?.focus();
  }).then(async (answer) => {
    if (answer && action) await action();
    return answer;
  });
}
let bankResolveDialog = null;
function bankAnswerDialog(answer) {
  $("#modalRoot").innerHTML = "";
  bankResolveDialog?.(answer);
  bankResolveDialog = null;
}
async function bankDiscard() {
  if (!dirty) return true;
  if (
    !(await bankDialog(
      "Discard changes?",
      "Your unsaved resource changes will be lost.",
      null,
      "Discard changes",
    ))
  )
    return false;
  dirty = false;
  return true;
}
async function bankNavigate(scope = "shared", category = "", restore = false) {
  if (busy || !(await bankDiscard())) return;
  if (!(scope in bankScopes)) scope = "shared";
  if (
    ["all", "review", "archived"].includes(scope) &&
    data.user.role !== "head"
  )
    scope = "shared";
  view = "bank";
  bank.sequence++;
  clearTimeout(bankSearchTimer);
  bank.scope = scope;
  bank.screen = "list";
  bank.error = "";
  bank.file = null;
  bank.uploadKey = null;
  bank.editing = null;
  if (!restore) {
    bank.filters = category ? { category } : {};
    bank.page = 1;
    bank.scroll = 0;
  }
  if (!bank.filters.sort)
    bank.filters.sort =
      scope === "review"
        ? "oldest"
        : ["shared", "recent"].includes(scope)
          ? "approved"
          : "updated";
  bank.result = null;
  bank.loading = true;
  bankUrl();
  render();
  await bankRead();
}
async function bankRead() {
  const sequence = ++bank.sequence;
  bank.loading = true;
  bank.error = "";
  bankPaintResults();
  try {
    const result = await bankApi().list(
      { scope: bank.scope, ...bank.filters },
      bank.page,
    );
    if (sequence !== bank.sequence || view !== "bank" || bank.screen !== "list")
      return;
    bank.result = result;
    if (data.user.role === "head") bank.stats = await bankApi().stats();
    bank.facets = await bankApi().facets();
  } catch (error) {
    if (sequence !== bank.sequence) return;
    bank.error = bankMessage(error);
  } finally {
    if (sequence === bank.sequence) {
      bank.loading = false;
      bankPaintResults();
      const stats = $("#bank-stats");
      if (stats) stats.innerHTML = bankStatistics();
    }
  }
}
function bankPaintResults() {
  const target = $("#bank-results");
  if (view === "bank" && bank.screen === "list" && target)
    target.innerHTML = bankResults();
}
let bankSearchTimer;
function bankSearch(input) {
  bank.filters.q = input.value.slice(0, 300);
  bank.page = 1;
  bankUrl();
  clearTimeout(bankSearchTimer);
  bankSearchTimer = setTimeout(bankRead, 300);
}
function bankLayout(layout) {
  bank.layout = ["grid", "board"].includes(layout) ? layout : "list";
  try {
    sessionStorage.setItem("sikap-bank-layout", bank.layout);
  } catch {
    /* Storage is optional. */
  }
  document
    .querySelectorAll("[data-bank-layout]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.bankLayout === bank.layout),
      ),
    );
  const app = document.querySelector(".bank-app");
  if (app) {
    for (const value of ["list", "grid", "board"])
      app.classList.toggle("bank-layout-" + value, bank.layout === value);
  }
  bankPaintResults();
}
async function bankPage(number) {
  bank.page = Math.max(1, number);
  await bankRead();
  $("#bank-results")?.scrollIntoView({ block: "start" });
}
async function bankFilter(event) {
  event.preventDefault();
  const form = new FormData(event.target),
    q = bank.filters.q;
  bank.filters = Object.fromEntries(
    [...form.entries()].filter(([, value]) => value),
  );
  if (q) bank.filters.q = q;
  bank.page = 1;
  bankUrl();
  render();
  await bankRead();
}
async function bankClear() {
  bank.filters = {};
  bank.page = 1;
  bankUrl();
  render();
  await bankRead();
}
function bankSort(value) {
  bank.filters.sort = value;
  bank.page = 1;
  bankUrl();
  bankRead();
}
async function bankOpen(id, internal = false) {
  if ((busy && !internal) || !(await bankDiscard())) return;
  bank.sequence++;
  clearTimeout(bankSearchTimer);
  bank.scroll = typeof scrollY === "number" ? scrollY : 0;
  bank.loading = true;
  bank.screen = "detail";
  bank.detail = null;
  bank.error = "";
  view = "bank";
  bankUrl(id);
  render();
  try {
    bank.detail = await bankApi().details(id);
  } catch (error) {
    bank.error = bankMessage(error);
  }
  bank.loading = false;
  render();
  const file = bank.detail?.versions[0];
  const target = $("#bank-docx-preview");
  if (target && file?.url && window.previewDocx)
    window.previewDocx(file.url, target);
}
async function bankBack() {
  if (!(await bankDiscard())) return;
  bank.screen = "list";
  bankUrl();
  render();
  await bankRead();
  window.scrollTo(0, bank.scroll);
}

function bankStatusFilter(value) {
  bank.filters.status = value;
  bank.page = 1;
  bankUrl();
  render();
  bankRead();
}

function bankThemeStyle() {
  const theme = appearanceThemes[bank.theme] || appearanceThemes.white;
  return `--sikap-bg:${theme.light ? "#fcfcfd" : theme.background};--sikap-accent:${theme.light ? "#456958" : theme.accent};--sikap-action:${theme.action};--ink:${theme.light ? "#24272c" : "#e4e9f0"};--muted:${theme.light ? "#737980" : "#9caab9"};--line:${theme.light ? "#e7e9ec" : "#ffffff16"};--bank-side:${theme.light ? "#f7f8f9" : theme.background};color:var(--ink);color-scheme:${theme.light ? "light" : "dark"}`;
}
function bankAppearanceMenu() {
  return `<details class="appearance-menu bank-palette"><summary class="icon-btn" aria-label="Choose color">${ico("palette")}</summary><div class="appearance-popover"><fieldset class="appearance-choices" aria-label="Workspace color theme">${Object.entries(
    appearanceThemes,
  )
    .map(
      ([key, theme]) =>
        `<label class="appearance-choice"><input type="radio" name="bank-theme" value="${key}" ${bank.theme === key ? "checked" : ""} onchange="bankSetTheme(this.value)" aria-label="${theme.label}"><span class="appearance-swatch" style="--swatch:${theme.light ? "#e7e9ed" : theme.accent}"></span><span>${theme.label}</span></label>`,
    )
    .join("")}</fieldset></div></details>`;
}
function bankSetTheme(value) {
  if (!appearanceThemes[value]) return;
  bank.theme = value;
  try {
    sessionStorage.setItem("sikap-bank-theme", value);
  } catch {}
  const app = document.querySelector(".bank-app");
  if (app) app.setAttribute("style", bankThemeStyle());
  document
    .querySelectorAll('input[name="bank-theme"]')
    .forEach((input) => (input.checked = input.value === value));
}

function bankNavigation() {
  const head = data.user.role === "head";
  const item = (scope, icon, title, category = "") =>
    `<button class="${bank.scope === scope && (bank.filters.category || "") === category ? "active" : ""}" onclick="bankNavigate('${scope}','${category}')">${ico(icon)}<span>${title}</span></button>`;
  return `<details class="bank-new"><summary>${ico("add")}New</summary><div><button onclick="bankUploadPage()">${ico("upload_file")}Upload Resource</button></div></details><nav aria-label="Digital Bank"><button onclick="go('dashboard')">${ico("home")}<span>Home</span></button>${item("shared", "database", "Digital Bank")}${item("mine", "folder_open", "My Resources")}${item("recent", "history", "Recent")}${item("saved", "bookmark", "Saved Resources")}${head ? item("review", "fact_check", "Resource Reviews") + item("all", "inventory_2", "All Resources") + item("archived", "archive", "Archived") : ""}<span class="bank-nav-label">Resource Bank</span>${Object.keys(
    bankCategories,
  )
    .map((key) =>
      item("shared", "folder", key[0] + key.slice(1).toLowerCase(), key),
    )
    .join(
      "",
    )}<span class="bank-nav-label">Workspace</span><button onclick="go('modules')">${ico("description")}<span>${head ? "All Modules" : "My Modules"}</span></button><button onclick="go('requirements')">${ico("assignment")}<span>Requirements</span></button>${head ? "<button onclick=\"go('teachers')\">" + ico("groups") + "<span>Teachers</span></button>" : ""}<button onclick="go('notifications')">${ico("notifications")}<span>Notifications</span></button></nav>`;
}
function bankRender() {
  const user = data.user;
  $("#app").innerHTML =
    `<div class="app bank-app bank-layout-${bank.layout}" style="${bankThemeStyle()}"><aside class="bank-sidebar" id="side"><div class="workspace-brand"><span class="brand-symbol">${ico("auto_stories")}</span><div class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></div></div>${bankNavigation()}<button class="bank-account" onclick="go('profile')"><span class="avatar">${avatarContent(user)}</span><span>${esc(user.name)}<small>${user.role === "head" ? "Head Teacher" : "Teacher"}</small></span></button></aside><div class="overlay" id="overlay" onclick="menu()"></div><main class="bank-main"><header class="bank-topbar"><button class="icon-btn bank-mobile-menu" onclick="menu()" aria-label="Open menu">${ico("menu")}</button><div class="bank-search">${ico("search")}<input type="search" aria-label="Search in Digital Bank" placeholder="Search in Digital Bank" maxlength="300" value="${esc(bank.filters.q || "")}" oninput="bankSearch(this)" ${bank.screen !== "list" ? 'onfocus="bankBack()"' : ""}><button class="icon-btn" aria-label="Open resource filters" onclick="bankOpenFilters()">${ico("tune")}</button></div><div class="bank-user-actions">${bankAppearanceMenu()}<button class="icon-btn" aria-label="Notifications" onclick="go('notifications')">${ico("notifications")}</button></div></header><section class="bank-content content">${bank.screen === "list" ? bankListPage() : bank.screen === "upload" ? bankUploadForm() : bankDetailPage()}</section></main></div><div id="modalRoot"></div>`;
}
function bankStatistics() {
  return data.user.role === "head" && bank.stats
    ? `<div class="bank-statistics" aria-label="Repository statistics">${[
        ["approved", "Approved"],
        ["pending", "Pending"],
        ["returned", "Returned"],
        ["methods", "Methods"],
        ["models", "Models"],
        ["units", "Units"],
      ]
        .map(
          ([key, title]) =>
            `<span>${title}<strong>${bank.stats[key]}</strong></span>`,
        )
        .join("")}</div>`
    : "";
}
function bankListPage() {
  return `<div class="bank-page-heading bank-collection-heading"><h1>${ico("database")}${bankScopes[bank.scope]}</h1><span>${bank.scope === "recent" ? "Latest approved resources" : ""}</span></div><nav class="bank-workspace-tabs" aria-label="Resource collections">${[
    ["shared", "database", "Digital Bank"],
    ["mine", "folder_open", "My Resources"],
    ...(data.user.role === "head"
      ? [
          ["all", "inventory_2", "All resources"],
          ["review", "fact_check", "Review queue"],
        ]
      : []),
    ["saved", "bookmark", "Saved"],
  ]
    .map(
      ([scope, icon, title]) =>
        `<button aria-current="${bank.scope === scope ? "page" : "false"}" onclick="bankNavigate('${scope}')">${ico(icon)}${title}</button>`,
    )
    .join("")}</nav><div id="bank-stats">${bankStatistics()}</div>${
    bank.scope === "shared"
      ? `<section class="bank-categories" aria-label="Resource categories">${Object.entries(
          bankCategories,
        )
          .map(
            ([key, title]) =>
              `<button aria-pressed="${bank.filters.category === key}" onclick="bankNavigate('shared','${key}')">${ico("folder")}<span><strong>${key[0] + key.slice(1).toLowerCase()}</strong><small>${title}</small></span></button>`,
          )
          .join("")}</section>`
      : ""
  }<div class="bank-toolbar"><details id="bank-filter-menu" ontoggle="if(this.open)this.querySelector('.bank-filter-popover').innerHTML=bankFilters()"><summary>${ico("filter_list")}Filters${Object.keys(bank.filters).filter((key) => key !== "sort" && bank.filters[key]).length ? '<span class="bank-filter-dot"></span>' : ""}</summary><div class="bank-filter-popover">${bankFilters()}</div></details>${Object.keys(bank.filters).some((key) => key !== "sort" && bank.filters[key]) ? '<button class="bank-text-button" onclick="bankClear()">Clear filters</button>' : ""}<span class="bank-toolbar-space"></span><label class="bank-sort">Sort<select aria-label="Sort resources" onchange="bankSort(this.value)">${[
    ["approved", "Recently approved"],
    ["updated", "Recently modified"],
    ["name", "Name"],
    ["newest", "Newest"],
    ["oldest", "Oldest"],
    ["creator", "Creator"],
  ]
    .map(
      ([key, title]) =>
        `<option value="${key}" ${bank.filters.sort === key ? "selected" : ""}>${title}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="bank-view-toggle" aria-label="Resource view"><button class="icon-btn" data-bank-layout="board" aria-label="Board view" aria-pressed="${bank.layout === "board"}" onclick="bankLayout('board')">${ico("view_kanban")}</button><button class="icon-btn" data-bank-layout="list" aria-label="List view" aria-pressed="${bank.layout === "list"}" onclick="bankLayout('list')">${ico("view_list")}</button><button class="icon-btn" data-bank-layout="grid" aria-label="Grid view" aria-pressed="${bank.layout === "grid"}" onclick="bankLayout('grid')">${ico("grid_view")}</button></div></div>${bank.filters.category ? `<div class="bank-breadcrumb">Digital Bank ${ico("chevron_right")} ${esc(bank.filters.category[0] + bank.filters.category.slice(1).toLowerCase())}</div>` : ""}${
    bank.scope === "mine"
      ? `<div class="bank-status-filters" aria-label="Submission status"><button onclick="bankStatusFilter('')" aria-pressed="${!bank.filters.status}">All</button>${Object.entries(
          bankStates,
        )
          .filter(([key]) => key !== "archived")
          .map(
            ([key, title]) =>
              `<button onclick="bankStatusFilter('${key}')" aria-pressed="${bank.filters.status === key}">${title}</button>`,
          )
          .join("")}</div>`
      : ""
  }<div id="bank-results" aria-live="polite">${bankResults()}</div>`;
}
function bankFilters() {
  const select = (name, title, options) =>
    `<label>${title}<select name="${name}"><option value="">All</option>${options
      .map((option) => {
        const [value, text] = Array.isArray(option) ? option : [option, option];
        return `<option value="${esc(value)}" ${bank.filters[name] === value ? "selected" : ""}>${esc(text)}</option>`;
      })
      .join("")}</select></label>`;
  return `<form onsubmit="bankFilter(event)"><div class="bank-filter-fields">${select("category", "Category", Object.keys(bankCategories))}${select("subject", "Learning area", bank.facets.subjects)}${select(
    "grade",
    "Grade level",
    [7, 8, 9, 10].map((n) => "Grade " + n),
  )}${select(
    "term",
    "Quarter",
    [1, 2, 3, 4].map((n) => "Quarter " + n),
  )}${select("creator", "Creator", bank.facets.creators)}${select(
    "type",
    "File type",
    [
      ["application/pdf", "PDF"],
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "DOCX",
      ],
    ],
  )}${["mine", "all"].includes(bank.scope) ? select("status", "Status", Object.entries(bankStates)) : ""}<label>Modified since<input type="date" name="date" value="${esc(bank.filters.date || "")}"></label></div><div class="form-actions"><button class="primary" type="submit">Apply filters</button></div></form>`;
}
function bankOpenFilters() {
  if (bank.screen !== "list") {
    bankBack().then(bankOpenFilters);
    return;
  }
  const menu = $("#bank-filter-menu");
  if (menu) {
    menu.querySelector(".bank-filter-popover").innerHTML = bankFilters();
    menu.open = true;
    menu.querySelector("select")?.focus();
  }
}
function bankActions(resource) {
  const state = bankState(resource),
    own = resource.owner === data.user.id,
    head = data.user.role === "head";
  return `<details class="bank-row-menu"><summary aria-label="Actions for ${esc(resource.title)}">${ico("more_vert")}</summary><div><button onclick="bankOpen('${resource.id}')">${ico("open_in_new")}Open details</button>${state !== "draft" ? `<button onclick="bankDownload('${resource.id}')">${ico("download")}Download</button><button onclick="bankSaveToggle('${resource.id}',${!resource.saved})">${ico(resource.saved ? "bookmark_remove" : "bookmark_add")}${resource.saved ? "Remove from saved" : "Save resource"}</button>` : ""}${own && state === "draft" ? `<button onclick="bankEditDraft('${resource.id}')">${ico("edit")}Edit draft</button><button onclick="bankDeleteDraft('${resource.id}',${resource.revision})">${ico("delete")}Delete draft</button>` : ""}${own && state === "returned" ? `<button onclick="bankOpen('${resource.id}')">${ico("upload_file")}Upload revision</button>` : ""}${head && !["draft", "archived"].includes(state) ? `<button onclick="bankArchive('${resource.id}',${resource.revision},true)">${ico("archive")}Archive</button>` : ""}${head && state === "archived" ? `<button onclick="bankArchive('${resource.id}',${resource.revision},false)">${ico("unarchive")}Restore</button>` : ""}</div></details>`;
}
function bankResults() {
  if (bank.loading)
    return `<div class="bank-skeleton" role="status" aria-label="Loading resources">${Array.from({ length: 6 }, () => "<div><span></span><span></span><span></span></div>").join("")}</div>`;
  if (bank.error)
    return `<div class="bank-empty" role="alert"><h2>Could not load resources</h2><p>${esc(bank.error)}</p><button class="secondary" onclick="bankRead()">Try again</button></div>`;
  const result = bank.result;
  if (!result?.items.length)
    return `<div class="bank-empty"><h2>${bank.scope === "review" ? "No resources are waiting for review" : "No resources found"}</h2><p>${Object.keys(bank.filters).length ? "No resources match these filters." : bank.scope === "shared" ? "Approved Project SIKAP resources will appear here." : bank.scope === "mine" ? "Your resource submissions and drafts will appear here." : "Resources will appear here when available."}</p>${bank.scope === "mine" ? '<button class="secondary" onclick="bankUploadPage()">Upload resource</button>' : ""}</div>`;
  const showStatus = !["shared", "recent"].includes(bank.scope);
  const rows = result.items
    .map(
      (resource) =>
        `<tr onclick="if(!event.target.closest('button,a,summary,details'))bankOpen('${resource.id}')"><td><div class="bank-file-name">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}<div><button onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button><small>${esc(resource.term)} · ${resource.filename ? esc(resource.filename) : "Draft"}${resource.saved ? " · Saved" : ""}</small></div></div></td><td data-label="Category">${esc(resource.category[0] + resource.category.slice(1).toLowerCase())}</td><td data-label="Learning area">${esc(resource.subject)}</td><td data-label="Grade">${esc(resource.grade)}</td><td data-label="Creator">${esc(resource.creator)}</td><td data-label="Modified">${date(resource.updated)}</td>${showStatus ? `<td>${bankBadge(resource)}</td>` : ""}<td>${bankActions(resource)}</td></tr>`,
    )
    .join("");
  const grid = result.items
    .map(
      (resource) =>
        `<article class="bank-grid-file"><div class="bank-grid-top">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}${bankActions(resource)}</div><button class="bank-grid-title" onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button><p>${esc(resource.category)} · ${esc(resource.subject)}</p><small>${esc(resource.creator)}</small>${showStatus ? bankBadge(resource) : ""}</article>`,
    )
    .join("");
  return `${bank.layout === "board" ? bankBoard(result.items) : bank.layout === "grid" ? `<div class="bank-grid">${grid}</div>` : `<table class="bank-table"><thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Learning area</th><th scope="col">Grade</th><th scope="col">Creator</th><th scope="col">Modified</th>${showStatus ? '<th scope="col">Status</th>' : ""}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table>`}<div class="bank-pagination"><span>${(result.page - 1) * 25 + 1}–${Math.min(result.page * 25, result.total)} of ${result.total}</span><button class="icon-btn" aria-label="Previous page" ${result.page === 1 ? "disabled" : ""} onclick="bankPage(${result.page - 1})">${ico("chevron_left")}</button><button class="icon-btn" aria-label="Next page" ${result.page * 25 >= result.total ? "disabled" : ""} onclick="bankPage(${result.page + 1})">${ico("chevron_right")}</button></div>`;
}
function bankDetailPage() {
  if (bank.loading) return bankResults();
  if (!bank.detail)
    return `<button class="bank-text-button" onclick="bankBack()">Back to resources</button><div class="bank-empty" role="alert"><h2>Resource unavailable</h2><p>${esc(bank.error)}</p></div>`;
  const detail = bank.detail,
    resource = detail.resource,
    state = bankState(resource),
    head = data.user.role === "head",
    own = resource.owner === data.user.id,
    file = detail.versions[0];
  return `<div class="bank-detail-heading"><button class="bank-text-button" onclick="bankBack()">${ico("arrow_back")} ${bankScopes[bank.scope]}</button><div><h1>${esc(resource.title)}</h1>${bankBadge(resource)}</div><p>Digital Bank / ${esc(resource.bank_category)} / ${esc(resource.title)}</p><div class="bank-detail-actions">${file && !file.unavailable ? `<a class="secondary" href="${esc(file.downloadUrl)}" download>${ico("download")}Download</a><button class="secondary" data-bank-save="${resource.id}" onclick="bankSaveToggle('${resource.id}',${!resource.saved})">${ico(resource.saved ? "bookmark" : "bookmark_add")}${resource.saved ? "Saved" : "Save"}</button>` : ""}${resource.bank_draft && own ? `<button class="primary" onclick="bankEditDraft('${resource.id}')">Edit draft</button>` : ""}${!resource.archived && !resource.bank_draft && (head || (own && state === "returned")) ? '<button class="secondary" onclick="bankMetadataPage()">Edit metadata</button>' : ""}${head && !resource.bank_draft ? `<button class="secondary" onclick="bankArchive('${resource.id}',${resource.revision},${!resource.archived})">${resource.archived ? "Restore" : "Archive"}</button>` : ""}</div></div><div class="bank-review-workspace"><div class="bank-document"><section><h2>Description</h2><p class="bank-prose">${esc(resource.bank_description)}</p><h2>Contextualization / Localization</h2><p class="bank-prose">${esc(resource.bank_localization)}</p></section><section><h2>File preview</h2>${!file ? "<p>No file attached to this draft.</p>" : file.unavailable ? '<p role="alert">File unavailable. Refresh the resource to renew access.</p>' : file.type === "application/pdf" ? `<iframe title="${esc(resource.title)} PDF preview" src="${esc(file.url)}"></iframe>` : '<div id="bank-docx-preview" class="bank-docx">Loading document text…</div>'}</section>${
    detail.private
      ? `<section><h2>Version history</h2>${
          detail.versions
            .map((version) => {
              const review = detail.reviews.find(
                (review) => review.version === version.version,
              );
              return `<div class="bank-history-entry"><strong>Version ${version.version}${resource.final_version === version.version ? " · Approved version" : ""}</strong><small>${date(version.created)} · ${esc(version.uploader)}</small><p>${esc(version.changes)}</p>${review ? `<p>${bankStates[review.decision]} · ${esc(review.reviewerName)} · ${date(review.created)}</p><p class="bank-prose">${esc(review.feedback)}</p>` : ""}${!version.unavailable ? `<a href="${esc(version.downloadUrl)}">Download version ${version.version}</a>` : "<span>File unavailable</span>"}</div>`;
            })
            .join("") || "<p>No submitted versions.</p>"
        }</section><section><h2>Activity</h2>${detail.events.map((event) => `<p>${esc(event.body)}<small>${esc(event.actorName)} · ${date(event.created)}</small></p>`).join("")}</section>`
      : ""
  }</div><aside class="bank-metadata"><h2>Resource details</h2><dl>${[
    ["Category", resource.bank_category],
    ["Learning area", resource.subject],
    ["Grade", resource.grade],
    ["Quarter", resource.term],
    ["Created by", resource.creator],
    ["Original upload", date(resource.bank_submitted_at || resource.created)],
    ["Approved by", resource.approverName || "—"],
    ["Approved on", resource.approved ? date(resource.approved) : "—"],
    ["Last updated", date(resource.updated)],
  ]
    .map(([name, value]) => `<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`)
    .join(
      "",
    )}</dl><h3>Learning competency</h3><p class="bank-prose">${esc(resource.bank_competency)}</p><h3>Tags</h3><div class="bank-tags">${resource.bank_tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>${resource.bank_source ? `<h3>Reference / Source</h3><p class="bank-prose">${esc(resource.bank_source)}</p>` : ""}${resource.bank_notes ? `<h3>Additional notes</h3><p class="bank-prose">${esc(resource.bank_notes)}</p>` : ""}${head && !own && ["pending", "resubmitted"].includes(state) ? bankReviewForm() : ""}${own && state === "returned" ? bankRevisionForm() : ""}</aside></div>`;
}

function bankBoard(items) {
  const shared = ["shared", "recent", "saved"].includes(bank.scope);
  const columns = shared
    ? Object.entries(bankCategories).map(([key, title]) => ({
        key,
        title: key[0] + key.slice(1).toLowerCase(),
        hint: title,
        icon: "folder",
        matches: (item) => item.category === key,
      }))
    : [
        {
          key: "draft",
          title: "Draft",
          icon: "radio_button_unchecked",
          matches: (item) => bankState(item) === "draft",
        },
        {
          key: "pending",
          title: "Pending review",
          icon: "schedule",
          matches: (item) =>
            ["pending", "resubmitted"].includes(bankState(item)),
        },
        {
          key: "returned",
          title: "Revision needed",
          icon: "change_circle",
          matches: (item) => bankState(item) === "returned",
        },
        {
          key: "approved",
          title: "Approved",
          icon: "check_circle",
          matches: (item) => bankState(item) === "approved",
        },
      ];
  if (bank.scope === "archived")
    columns.splice(0, columns.length, {
      key: "archived",
      title: "Archived",
      icon: "archive",
      matches: () => true,
    });
  return `<div class="bank-board" aria-label="Resource board">${columns
    .filter((column) => !bank.boardHidden.includes(column.key))
    .map((column) => {
      const resources = items.filter(column.matches);
      return `<section class="bank-board-column"><header><span class="bank-board-state bank-board-state-${column.key}">${ico(column.icon)}</span><h2>${column.title}</h2><span class="bank-board-count">${resources.length}</span><span class="bank-board-column-space"></span><details class="bank-column-menu"><summary aria-label="${column.title} column options">${ico("more_horiz")}</summary><div><button onclick="bankHideColumn('${column.key}')">Hide column</button><button onclick="bankLayout('list')">View as list</button></div></details>${bank.scope === "mine" ? `<button class="bank-board-add" aria-label="Upload resource" onclick="bankUploadPage()">${ico("add")}</button>` : ""}</header><div class="bank-board-stack">${resources.map(bankBoardCard).join("") || '<div class="bank-board-empty">No resources</div>'}</div></section>`;
    })
    .join("")}${
    columns.some((column) => bank.boardHidden.includes(column.key))
      ? `<aside class="bank-hidden-columns"><h2>${ico("arrow_drop_down")}Hidden columns</h2>${columns
          .filter((column) => bank.boardHidden.includes(column.key))
          .map(
            (column) =>
              `<button onclick="bankHideColumn('${column.key}')"><span class="bank-board-state bank-board-state-${column.key}">${ico(column.icon)}</span>${column.title}<span>${items.filter(column.matches).length}</span>${ico("more_horiz")}</button>`,
          )
          .join("")}</aside>`
      : ""
  }</div>`;
}
function bankBoardCard(resource) {
  const initials = (resource.creator || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const categoryLabel =
    resource.category[0] + resource.category.slice(1).toLowerCase();
  return `<article class="bank-board-card"><div class="bank-board-card-top"><span>SIK-${esc(resource.id.slice(-6).toUpperCase())}-${resource.version}</span><span class="bank-creator-mini" title="${esc(resource.creator)}" aria-label="Created by ${esc(resource.creator)}">${esc(initials)}</span></div><div class="bank-board-card-title">${ico(bankState(resource) === "approved" ? "check_circle" : "radio_button_unchecked")}<button onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button></div><div class="bank-board-card-bottom"><span class="bank-type-mini" aria-label="${resource.type === "application/pdf" ? "PDF" : resource.type ? "DOCX" : "Draft"}">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}</span><span class="bank-board-label"><span class="bank-category-mark bank-category-${resource.category.toLowerCase()}"></span>${categoryLabel}</span><span class="bank-board-label bank-subject-label">${esc(resource.subject)}</span>${bankActions(resource)}</div></article>`;
}

function bankHideColumn(key) {
  bank.boardHidden = bank.boardHidden.includes(key)
    ? bank.boardHidden.filter((value) => value !== key)
    : [...bank.boardHidden, key];
  bankPaintResults();
}

function bankUploadForm() {
  const resource = bank.editing || {},
    edit = bank.editing && !resource.bank_draft;
  const input = (name, title, value, max, multiline = false, required = true) =>
    `<label class="bank-form-field ${multiline ? "bank-form-wide" : ""}">${title}${multiline ? `<textarea name="${name}" maxlength="${max}" ${required ? "required" : ""}>${esc(value || "")}</textarea>` : `<input name="${name}" maxlength="${max}" value="${esc(value || "")}" ${required ? "required" : ""}>`}</label>`;
  const select = (name, title, value, options) =>
    `<label class="bank-form-field">${title}<select name="${name}" required><option value="">Choose ${title.toLowerCase()}</option>${options.map((option) => `<option ${option === value ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`;
  return `<button class="bank-text-button" onclick="bankBack()">${ico("arrow_back")}Back to resources</button><div class="bank-page-heading"><h1>${edit ? "Edit resource metadata" : resource.id ? "Edit draft" : "Upload resource"}</h1></div><form class="bank-resource-form" onsubmit="bankSubmitForm(event)"><div class="bank-form-grid">${input("title", "Resource title", resource.title, 200)}${select("category", "Category", resource.bank_category, Object.keys(bankCategories))}${input("subject", "Subject / Learning area", resource.subject, 200)}${select(
    "grade",
    "Grade level",
    resource.grade,
    [7, 8, 9, 10].map((n) => "Grade " + n),
  )}${select(
    "term",
    "Quarter",
    resource.term,
    [1, 2, 3, 4].map((n) => "Quarter " + n),
  )}<label class="bank-form-field">Creator<input value="${esc(resource.creator || data.user.name)}" readonly></label>${input("description", "Description", resource.bank_description, 5000, true)}${input("competency", "Learning competency", resource.bank_competency, 3000, true)}${input("localization", "Contextualization / Localization", resource.bank_localization, 5000, true)}${input("tags", "Keywords / Tags (comma separated)", resource.bank_tags?.join(", "), 1000)}${input("source", "Reference / Source (optional)", resource.bank_source, 2000, false, false)}${input("notes", "Additional notes (optional)", resource.bank_notes, 3000, true, false)}</div>${edit ? "" : bankFileInput()}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" onclick="bankBack()">Cancel</button>${edit ? '<button type="submit" class="primary" name="action" value="metadata">Save metadata</button>' : '<button type="submit" class="secondary" name="action" value="draft">Save draft</button><button type="submit" class="primary" name="action" value="submit">Submit for review</button>'}</div></form>`;
}
function bankFileInput() {
  return `<div class="bank-drop-zone" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="bankDrop(event)">${ico("upload_file")}<strong>Drag and drop your file here</strong><label class="bank-browse">or browse files<input id="bank-file" type="file" accept=".pdf,.docx" onchange="bankSelectFile(this.files[0])"></label><small>PDF or DOCX · up to 20 MB</small><div id="bank-file-summary">${bankFileSummary()}</div><div class="bank-upload-progress" hidden><label for="bank-progress">Uploading and verifying file…</label><progress id="bank-progress" max="100" value="0"></progress><span id="bank-progress-text" role="status">0%</span></div></div>`;
}
function bankFileSummary() {
  return bank.file
    ? `<div class="bank-selected-file">${ico(bank.file.name.toLowerCase().endsWith(".pdf") ? "picture_as_pdf" : "description")}<span>${esc(bank.file.name)}<small>${bank.file.name.split(".").pop().toUpperCase()} · ${size(bank.file.size)}</small></span><button class="icon-btn" type="button" aria-label="Remove selected file" onclick="bankSelectFile(null)">${ico("close")}</button></div>`
    : "";
}
async function bankSelectFile(file) {
  if (busy) return;
  if (
    bank.file &&
    file !== bank.file &&
    !(await bankDialog(
      "Replace selected file?",
      "The selected file will be removed from this form. Submitted versions remain unchanged.",
      null,
      file ? "Replace file" : "Remove file",
    ))
  )
    return;
  const error = $(
    ".bank-resource-form .form-error, .bank-revision-form .form-error",
  );
  if (file) {
    try {
      await window.sikapBackend.validateBankFile(file);
    } catch (failure) {
      if (error) error.textContent = bankMessage(failure);
      return;
    }
  }
  bank.file = file || null;
  bank.uploadKey = null;
  dirty = true;
  if (error) error.textContent = "";
  const input = $("#bank-file");
  if (input) input.value = "";
  const summary = $("#bank-file-summary");
  if (summary) summary.innerHTML = bankFileSummary();
}
function bankDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  if (event.dataTransfer.files.length !== 1) {
    toast("Choose one PDF or DOCX file.");
    return;
  }
  bankSelectFile(event.dataTransfer.files[0]);
}
async function bankUploadPage() {
  if (busy || !(await bankDiscard())) return;
  bank.sequence++;
  clearTimeout(bankSearchTimer);
  view = "bank";
  bank.screen = "upload";
  bank.editing = null;
  bank.file = null;
  bank.uploadKey = null;
  bank.uploadId = crypto.randomUUID();
  render();
  $(".bank-resource-form input")?.focus();
}
async function bankEditDraft(id) {
  if (busy || !(await bankDiscard())) return;
  try {
    bank.detail = await bankApi().details(id);
    bank.editing = bank.detail.resource;
    bank.uploadId = id;
    bank.file = null;
    bank.uploadKey = null;
    bank.screen = "upload";
    render();
  } catch (error) {
    toast(bankMessage(error));
  }
}
function bankMetadataPage() {
  bank.editing = bank.detail.resource;
  bank.screen = "upload";
  render();
}
function bankReviewForm() {
  return `<form class="bank-review-form" onsubmit="bankReview(event)"><h2>Quality assurance</h2>${reviewChecklist()}<label class="bank-form-field">Revision feedback<textarea name="feedback" maxlength="5000"></textarea></label><p class="form-error" role="alert"></p><div class="form-actions"><button type="submit" class="secondary" name="decision" value="returned">Return for revision</button><button type="submit" class="primary" name="decision" value="approved">Approve</button></div></form>`;
}
function bankRevisionForm() {
  return `<form class="bank-revision-form" onsubmit="bankRevise(event)"><h2>Upload revision</h2>${bankFileInput()}<label class="bank-form-field">Changes in this version<textarea name="changes" maxlength="3000" required></textarea></label><p class="form-error" role="alert"></p><button type="submit" class="primary">Resubmit for review</button></form>`;
}

async function bankRunForm(event, operation) {
  event.preventDefault();
  if (busy) return;
  const form = event.target,
    error = form.querySelector(".form-error"),
    buttons = [...form.querySelectorAll("button")];
  error.textContent = "";
  busy = true;
  buttons.forEach((button) => (button.disabled = true));
  try {
    await operation(form);
  } catch (failure) {
    error.textContent = bankMessage(failure);
  } finally {
    busy = false;
    buttons.forEach((button) => (button.disabled = false));
  }
}
async function bankUploadFile() {
  if (!bank.file) throw Error("Choose a PDF or DOCX file before submitting.");
  if (bank.uploadKey) return bank.uploadKey;
  const host = $(".bank-upload-progress");
  if (host) host.hidden = false;
  bank.uploadKey = await bankApi().upload(
    bank.uploadId,
    bank.file,
    (percent) => {
      const progress = $("#bank-progress"),
        text = $("#bank-progress-text");
      if (progress) progress.value = percent;
      if (text)
        text.textContent = percent === 100 ? "Verifying file…" : percent + "%";
    },
  );
  const text = $("#bank-progress-text");
  if (text) text.textContent = "File verified";
  return bank.uploadKey;
}
async function bankSubmitForm(event) {
  const action = event.submitter?.value || "submit";
  await bankRunForm(event, async (form) => {
    const fields = Object.fromEntries(new FormData(form));
    fields.tags = [
      ...new Set(
        fields.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    if (!fields.tags.length || fields.tags.length > 20)
      throw Error("Enter 1 to 20 comma-separated tags.");
    if (action === "metadata") {
      await bankApi().edit({
        mid: bank.editing.id,
        d: fields,
        expected_revision: bank.editing.revision,
      });
      dirty = false;
      await bankOpen(bank.editing.id, true);
      toast("Resource metadata updated.");
      return;
    }
    const objectKey = action === "submit" ? await bankUploadFile() : null;
    const id = await bankApi().save({
      mid: bank.uploadId,
      d: fields,
      expected_revision: bank.editing?.revision || null,
      object_key: objectKey,
      submit: action === "submit",
    });
    dirty = false;
    bank.file = null;
    bank.uploadKey = null;
    // Refreshing after a successful mutation cannot cause a duplicate submission.
    bank.scope = "mine";
    bank.screen = "list";
    bank.filters = { sort: "updated" };
    bank.page = 1;
    bankUrl();
    render();
    await bankRead();
    toast(
      action === "submit" ? "Resource submitted for review." : "Draft saved.",
    );
    return id;
  });
}
async function bankReview(event) {
  const decision = event.submitter?.value,
    form = event.target;
  event.preventDefault();
  const feedback = new FormData(form).get("feedback").trim();
  if (decision === "returned" && !feedback) {
    form.querySelector(".form-error").textContent =
      "Write revision feedback before returning this resource.";
    return;
  }
  if (
    decision === "approved" &&
    !(await bankDialog(
      "Approve this resource?",
      "This resource will become available to approved school accounts in the Project SIKAP Digital Bank.",
      null,
      "Approve resource",
    ))
  )
    return;
  await bankRunForm(event, async () => {
    const resource = bank.detail.resource;
    await bankApi().decide({
      mid: resource.id,
      expected_revision: resource.revision,
      decision,
      feedback,
      checks: readChecklist(form),
    });
    dirty = false;
    await bankOpen(resource.id, true);
    toast(
      decision === "approved"
        ? "Resource approved and added to Digital Bank."
        : "Resource returned with revision feedback.",
    );
  });
}
async function bankRevise(event) {
  await bankRunForm(event, async (form) => {
    const resource = bank.detail.resource;
    bank.uploadId = resource.id;
    const objectKey = await bankUploadFile();
    await bankApi().revise({
      mid: resource.id,
      expected_revision: resource.revision,
      object_key: objectKey,
      changes: new FormData(form).get("changes").trim(),
    });
    bank.file = null;
    bank.uploadKey = null;
    dirty = false;
    await bankOpen(resource.id, true);
    toast("Revision submitted for review.");
  });
}
async function bankSaveToggle(id, value) {
  try {
    await bankApi().saved(id, value);
    if (bank.detail?.resource.id === id) bank.detail.resource.saved = value;
    if (bank.screen === "list") await bankRead();
    else {
      const button = document.querySelector('[data-bank-save="' + id + '"]');
      if (button) {
        button.innerHTML =
          ico(value ? "bookmark" : "bookmark_add") + (value ? "Saved" : "Save");
        button.setAttribute(
          "onclick",
          "bankSaveToggle('" + id + "'," + !value + ")",
        );
      }
    }
    toast(value ? "Resource saved." : "Removed from saved resources.");
  } catch (error) {
    toast(bankMessage(error));
  }
}
async function bankDownload(id) {
  try {
    const detail = await bankApi().details(id),
      file = detail.versions[0];
    if (!file?.downloadUrl || file.unavailable)
      throw Error("File unavailable. Refresh the resource and try again.");
    const link = document.createElement("a");
    link.href = file.downloadUrl;
    link.download = file.name;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    toast(bankMessage(error));
  }
}
async function bankArchive(id, revision, archive) {
  await bankDialog(
    archive ? "Archive resource?" : "Restore resource?",
    archive
      ? "This resource will leave the shared Digital Bank. Its files, creator attribution and review history will be preserved."
      : "Approved resources will become available in the shared Digital Bank again.",
    async () => {
      try {
        await bankApi().archive({
          mid: id,
          expected_revision: revision,
          archive,
        });
        if (bank.screen === "detail") await bankOpen(id);
        else await bankRead();
        toast(archive ? "Resource archived." : "Resource restored.");
      } catch (error) {
        toast(bankMessage(error));
      }
    },
    archive ? "Archive resource" : "Restore resource",
  );
}
async function bankDeleteDraft(id, revision) {
  await bankDialog(
    "Delete draft?",
    "This removes the unsubmitted draft. Submitted resources and version histories cannot be deleted here.",
    async () => {
      try {
        await bankApi().deleteDraft({ mid: id, expected_revision: revision });
        await bankRead();
        toast("Draft deleted.");
      } catch (error) {
        toast(bankMessage(error));
      }
    },
    "Delete draft",
  );
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
let authMode = "login",
  dirty = false;
let moduleNavOpen = false;
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
  dashboard: "Overview",
  requirements: "Requirements",
  modules: "My Modules",
  library: "Approved Modules",
  reviews: "Review Queue",
  submit: "Submit a module",
  notes: "Personal Notes",
  notifications: "Notifications",
  teachers: "Teachers",
  profile: "Profile",
  review: "Module details",
  starred: "Saved Modules",
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
  if (next === "bank") {
    await bankNavigate();
    return;
  }
  if (view === "bank" && !(await bankDiscard())) return;
  if (view === "bank" && typeof history !== "undefined")
    history.replaceState(null, "", location.pathname + location.search);
  if (busy) return;
  if (dirty && !confirm("Discard your unsaved changes?")) return;
  busy = true;
  try {
    const fresh = await api("state");
    data = fresh;
    if (
      ["archive", "reports"].includes(next) ||
      (next === "submit" && data.user.role === "head")
    )
      next = "dashboard";
    view = next;
    if (["modules", "library", "starred"].includes(next)) moduleNavOpen = true;
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
  return `<button class="${view === key ? "active" : ""}" aria-label="${key === "submit" ? "Submit module" : text}" title="${key === "submit" ? "Submit module" : text}" onclick="go('${key}')"><span class="nav-ico">${ico(icon)}</span><span class="nav-label">${text}</span>${count ? `<span class="nav-count${key === "notifications" ? " notification-count" : ""}">${count}</span>` : ""}</button>`;
}
function modulesNav(head, active) {
  const selected = ["modules", "library", "starred"].includes(view);
  return `<div class="nav-module-group ${selected ? "is-selected" : ""}"><div class="nav-module-row">${navItem("modules", "folder_open", head ? "All Modules" : "My Modules", active.length)}<button class="module-nav-toggle" type="button" aria-label="${moduleNavOpen ? "Collapse" : "Expand"} module sections" aria-expanded="${moduleNavOpen}" aria-controls="module-subnav" onclick="toggleModuleSections(this)">${ico("expand_more")}</button></div><div id="module-subnav" class="nav-module-children" ${moduleNavOpen ? "" : "hidden"}>${navItem("library", "task_alt", "Approved Modules")}${navItem("starred", "bookmark", "Saved Modules")}</div></div>`;
}
function toggleModuleSections(button) {
  moduleNavOpen = !moduleNavOpen;
  const children = $("#module-subnav");
  if (children) children.hidden = !moduleNavOpen;
  button.setAttribute("aria-expanded", String(moduleNavOpen));
  button.setAttribute(
    "aria-label",
    `${moduleNavOpen ? "Collapse" : "Expand"} module sections`,
  );
}
function render() {
  if (!data) return;
  if (view === "bank") {
    bankRender();
    return;
  }
  const u = data.user,
    head = u.role === "head",
    active = data.modules.filter((m) => !m.archived),
    unread = data.notifications.filter((n) => !n.read).length;
  $("#app").innerHTML =
    `<div class="app${view === "dashboard" ? " bank-app overview-app" : ""}" style="--sidebar-width:${width}px;${view === "dashboard" ? bankThemeStyle() : ""}"><aside class="sidebar" id="side"><div class="workspace-brand"><span class="brand-symbol">${ico("auto_stories")}</span><div class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></div></div><button class="profile-head" onclick="go('profile')" aria-label="Open profile"><div class="avatar">${avatarContent(u)}</div><div><strong>${esc(u.name)}</strong><small>${head ? "Head Teacher" : "Teacher"}${u.assignment ? " · " + esc(u.assignment) : ""}</small></div>${ico("chevron_right")}</button>${view === "dashboard" ? overviewNew() : ""}<nav class="nav">${navItem("dashboard", "dashboard", "Overview")}${navItem("bank", "database", "Digital Bank")}${navItem("requirements", "assignment", "Requirements")}${!head ? navItem("submit", "upload_file", "Submit Module") : ""}${modulesNav(head, active)}${head ? navItem("reviews", "fact_check", "Review Queue", active.filter((m) => m.status === "pending").length) : ""}${navItem("notes", "description", "Personal Notes", data.notes.length)}${head ? navItem("teachers", "groups", "Teachers", data.teachers.filter((u) => u.approval_status === "pending").length) : ""}${navItem("notifications", "notifications", "Notifications", unread)}</nav><button class="logout-btn" onclick="logout()">${ico("logout")}<span>Log out</span></button><div class="sidebar-resizer" role="separator" aria-label="Resize sidebar" aria-orientation="vertical" onpointerdown="resizeSide(event)"></div></aside><div class="overlay" id="overlay" onclick="menu()"></div><main class="main"><header class="topbar"><div class="page-heading"><button class="icon-btn mobile-menu" onclick="menu()" aria-label="Open menu">${ico("menu")}</button><h1>${view === "modules" && head ? "All Modules" : titles[view]}</h1></div><div class="top-actions">${view === "dashboard" ? bankAppearanceMenu() : appearanceMenu()}<button class="icon-btn" onclick="go('notifications')" aria-label="Notifications">${ico("notifications")}${unread ? '<span class="unread"></span>' : ""}</button>${!head && view !== "submit" ? '<button class="primary submit-plus" aria-label="Submit module" title="Submit module" onclick="go(\'submit\')">+</button>' : ""}</div></header><section class="content">${page()}</section></main></div><div id="modalRoot"></div>`;
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
  if (result)
    result.innerHTML =
      view === "dashboard" ? overviewResults() : moduleResults();
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
function page() {
  if (view === "dashboard") return overviewPage();
  if (["modules", "library", "reviews", "starred"].includes(view))
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
    else if (bankResolveDialog) bankAnswerDialog(false);
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
  if (
    e.target.closest?.(".content form, #modalRoot form") &&
    !e.target.closest?.(".bank-filter-popover")
  )
    dirty = true;
});
document.addEventListener("change", (e) => {
  if (
    e.target.closest?.(".content form, #modalRoot form") &&
    !e.target.closest?.(".bank-filter-popover")
  )
    dirty = true;
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
