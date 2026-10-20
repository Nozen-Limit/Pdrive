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
