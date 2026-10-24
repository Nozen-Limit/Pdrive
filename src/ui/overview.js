let overviewLayout = "board";
function overviewPage() {
  if (overview.screen === "summary" && data.user.role === "head")
    return `<nav class="bank-workspace-tabs" aria-label="Overview pages"><button onclick="overviewStatus('all')">${ico("arrow_back")}All resources</button><button aria-current="page">${ico("groups")}Summary</button></nav>${overviewSummaryContent()}`;
  return `<nav class="bank-workspace-tabs" aria-label="Resource status">${[
    ["all", "All resources", "folder_open"],
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
    )}${data.user.role === "head" ? `<button onclick="overviewSummaryPage()">${ico("groups")}Summary</button>` : ""}</nav><div class="overview-toolbar"><div class="overview-search">${ico("search")}<input type="search" aria-label="Search resources" placeholder="Search resources" value="${esc(filters.search)}" oninput="overviewSearch(this.value)"></div><div class="bank-view-toggle" aria-label="Resource view"><button class="icon-btn" aria-label="Board view" aria-pressed="${overviewLayout === "board"}" onclick="overviewView('board')">${ico("view_kanban")}</button><button class="icon-btn" aria-label="List view" aria-pressed="${overviewLayout === "list"}" onclick="overviewView('list')">${ico("view_list")}</button></div></div>${filterPanel()}<div id="module-results">${overviewResults()}</div><div class="overview-support"><section><header><h2>${ico("database")}Digital Bank</h2><button class="bank-text-button" onclick="bankNavigate(data.user.role === 'head' ? 'all' : 'mine')">Open resources</button></header>${overviewBankCounts()}</section><section><header><h2>${ico("description")}Pinned notes</h2><button class="bank-text-button" onclick="go('notes')">Manage notes</button></header>${
    data.notes
      .filter((note) => note.pinned)
      .slice(0, 3)
      .map(
        (note) =>
          `<article class="overview-note"><strong>${esc(note.title)}</strong><p>${esc(note.body)}</p></article>`,
      )
      .join("") || '<p class="overview-muted">No pinned notes.</p>'
  }</section><section><header><h2>${ico("history")}Recent resource updates</h2></header>${overviewRecent()}</section></div>`;
}
function overviewResults() {
  const state = overviewState();
  if (state) return state;
  if (overviewLayout === "list") return overviewList();
  const modules = filtered();
  return `<div class="bank-board overview-board" aria-label="Resource board">${[
    ["pending", "Pending review", "schedule"],
    ["returned", "Revision needed", "change_circle"],
    ["approved", "Approved", "check_circle"],
  ]
    .map(([status, title, icon]) => {
      const items = modules.filter((module) => module.status === status);
      return `<section class="bank-board-column"><header><span class="bank-board-state bank-board-state-${status}">${ico(icon)}</span><h2>${title}</h2><span class="bank-board-count">${items.length}</span><span class="bank-board-column-space"></span><button class="bank-board-add" aria-label="Open ${title.toLowerCase()} resources" onclick="overviewStatus('${status}')">${ico("open_in_new")}</button></header><div class="bank-board-stack">${items.map(overviewCard).join("") || '<div class="bank-board-empty">No resources</div>'}</div></section>`;
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
  return `<article class="bank-board-card"><div class="bank-board-card-top"><span>${esc(module.category)} · v${module.version}</span><span class="bank-creator-mini" aria-label="Created by ${esc(teacher)}" title="${esc(teacher)}">${esc(initials)}</span></div><div class="bank-board-card-title">${ico(module.status === "approved" ? "check_circle" : "radio_button_unchecked")}<button onclick="overviewOpen('${module.id}')">${esc(module.title)}</button></div><div class="bank-board-card-bottom"><span class="bank-type-mini">${ico("description")}</span><span class="bank-board-label">${esc(module.subject)}</span><span class="bank-board-label">${esc(module.grade)}</span><span class="bank-board-label">${esc(module.term)}</span><details class="bank-row-menu"><summary aria-label="Actions for ${esc(module.title)}">${ico("more_vert")}</summary><div><button onclick="overviewOpen('${module.id}')">${ico("open_in_new")}Open resource</button><button onclick="bankDownload('${module.id}')">${ico("download")}Download</button>${overviewArchiveAction(module)}</div></details></div><p class="module-meta">Updated ${date(module.updated)}</p></article>`;
}
function overviewStatus(status) {
  overview.screen = "resources";
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
function overviewNew() {
  return `<details class="bank-new overview-new"><summary>${ico("add")}New</summary><div><button onclick="bankUploadPage()">${ico("upload_file")}Upload resource</button></div></details>`;
}
