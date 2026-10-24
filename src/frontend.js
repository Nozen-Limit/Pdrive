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
  busy = false;
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
    if (view === "dashboard") await overviewRead();
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
  workspaceRender({
    classes: view === "dashboard" ? "overview-app" : "",
    navigation: `${overviewNew()}<nav class="nav">${navItem("dashboard", "dashboard", "Overview")}${navItem("bank", "database", "Digital Bank")}${head ? `<button onclick="bankNavigate('review')"><span class="nav-ico">${ico("fact_check")}</span><span class="nav-label">Review Queue</span></button>` : ""}${head ? `<button onclick="bankNavigate('archived')"><span class="nav-ico">${ico("archive")}</span><span class="nav-label">Archived resources</span></button>` : ""}${navItem("notes", "description", "Personal Notes", data.notes.length)}${head ? navItem("teachers", "groups", "Teachers", data.teachers.filter((u) => u.approval_status === "pending").length) : ""}${navItem("notifications", "notifications", "Notifications", unread)}</nav>`,
    heading: `<div class="page-heading"><button class="icon-btn mobile-menu" onclick="menu()" aria-label="Open menu">${ico("menu")}</button><h1>${view === "modules" && head ? "All Modules" : titles[view]}</h1></div>`,
    actions: `${bankAppearanceMenu()}<button class="icon-btn" onclick="go('notifications')" aria-label="Notifications">${ico("notifications")}${unread ? '<span class="unread"></span>' : ""}</button>${!head && view !== "submit" ? '<button class="primary submit-plus" aria-label="Upload resource" title="Upload resource" onclick="bankUploadPage()">+</button>' : ""}`,
    content: page(),
  });
}
function menu() {
  $("#side").classList.toggle("open");
  $("#overlay").classList.toggle("show");
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
    active = (view === "dashboard" ? overview.items : data.modules).filter(
      (m) => (view === "archive" ? m.archived : !m.archived),
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
  return `<div class="filter-shell ${filterOpen ? "is-open" : ""}"><div class="mobile-filter-bar"><span class="filter-caption">${count ? `${count} active filter${count === 1 ? "" : "s"}` : "All submissions"}</span><button id="mobile-filter-toggle" class="icon-btn mobile-filter-toggle" aria-label="Filters${count ? `, ${count} active` : ""}" title="Filters" aria-expanded="${filterOpen}" aria-controls="workspace-filter-panel" onclick="toggleFilters()">${ico("tune")}<span>Filters</span>${ico("expand_more")}${count ? `<span class="filter-count">${count}</span>` : ""}</button></div><div id="workspace-filter-panel" class="academic-filters workspace-filters" role="region" aria-label="Module filters"><div class="mobile-filter-heading"><h3>Filters</h3><button class="icon-btn" aria-label="Close filters" onclick="closeFilters()">${ico("close")}</button></div><div class="academic-filter search-filter"><label for="search">Search modules</label><input id="search" placeholder="Title or teacher name" value="${esc(current.search)}" oninput="searchModules(this.value)"></div>${select("subject", "Subject", unique("subject"))}${select("grade", "Grade / Year level", unique("grade"))}${select("term", "Quarter / Semester", unique("term"))}${view === "dashboard" ? "" : select("year", "School year", unique("year"))}${filterDropdown("status", "Status", [{ value: "all", text: "All statuses" }, ...["pending", "approved", "returned"].map((value) => ({ value, text: label(value) }))])}${filterDropdown(
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
  let list = (view === "dashboard" ? overview.items : data.modules).filter(
    (m) => (view === "archive" ? m.archived : !m.archived),
  );
  if (view === "library") list = list.filter((m) => m.status === "approved");
  if (view === "reviews") list = list.filter((m) => m.status === "pending");
  if (view === "starred") list = list.filter((m) => m.starred);
  list = list.filter(
    (m) =>
      ["subject", "grade", "term", "year"].every(
        (k) =>
          (view === "dashboard" && k === "year") ||
          filters[k] === "all" ||
          m[k] === filters[k],
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
