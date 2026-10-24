function bankNavigation() {
  const head = data.user.role === "head";
  const item = (scope, icon, title, category = "") =>
    `<button class="${bank.screen !== "collaboration" && bank.scope === scope && (bank.filters.category || "") === category ? "active" : ""}" onclick="bankNavigate('${scope}','${category}')">${ico(icon)}<span>${title}</span></button>`;
  return `<details class="bank-new"><summary>${ico("add")}New</summary><div><button onclick="bankUploadPage()">${ico("upload_file")}Upload Resource</button></div></details><nav aria-label="Digital Bank"><button onclick="go('dashboard')">${ico("home")}<span>Home</span></button>${item("shared", "database", "Digital Bank")}${bankLocalPreviewAvailable() ? '<button class="' + (bank.screen === "collaboration" ? "active" : "") + '" onclick="bankCollaborationPage()">' + ico("group_work") + "<span>Collaboration</span></button>" : ""}${item("mine", "folder_open", "My Resources")}${item("recent", "history", "Recent")}${item("saved", "bookmark", "Saved Resources")}${head ? item("review", "fact_check", "Resource Reviews") + item("all", "inventory_2", "All Resources") + item("archived", "archive", "Archived") : ""}<span class="bank-nav-label">Resource Bank</span>${Object.keys(
    bankCategories,
  )
    .map((key) =>
      item("shared", "folder", key[0] + key.slice(1).toLowerCase(), key),
    )
    .join(
      "",
    )}<span class="bank-nav-label">Workspace</span><button onclick="go('notes')">${ico("description")}<span>Personal Notes</span></button>${head ? "<button onclick=\"go('teachers')\">" + ico("groups") + "<span>Teachers</span></button>" : ""}<button onclick="go('notifications')">${ico("notifications")}<span>Notifications</span></button></nav>`;
}
function bankRender() {
  workspaceRender({
    classes: `bank-layout-${bank.layout}`,
    navigation: bankNavigation(),
    heading: `<button class="icon-btn bank-mobile-menu" onclick="menu()" aria-label="Open menu">${ico("menu")}</button><div class="bank-search">${ico("search")}<input type="search" aria-label="Search in Digital Bank" placeholder="Search in Digital Bank" maxlength="300" value="${esc(bank.filters.q || "")}" oninput="bankSearch(this)" ${bank.screen !== "list" ? 'onfocus="bankBack()"' : ""}><button class="icon-btn" aria-label="Open resource filters" onclick="bankOpenFilters()">${ico("tune")}</button></div>`,
    actions: `${bankAppearanceMenu()}<button class="icon-btn" aria-label="Notifications" onclick="go('notifications')">${ico("notifications")}</button>`,
    content:
      bank.screen === "collaboration"
        ? '<div id="bank-collaboration-preview" role="region" aria-label="Collaboration preview"></div>'
        : bank.screen === "list"
          ? bankListPage()
          : bank.screen === "upload"
            ? bankUploadForm()
            : bankDetailPage(),
    bankPage: true,
  });
  if (bank.screen === "collaboration")
    window.sikapCollaboration?.mount(data.user.role);
  else if (bank.screen === "list") bankPaintCollaboration();
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
  }<div id="bank-results" aria-live="polite">${bankResults()}</div><div id="bank-collaboration-published" class="muted" role="status"></div>`;
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
  if (resource.localCollaboration)
    return `<details class="bank-row-menu"><summary aria-label="Actions for ${esc(resource.title)}">${ico("more_vert")}</summary><div><button onclick="bankOpen('${resource.id}')">${ico("open_in_new")}Open details</button></div></details>`;
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
  const schoolResult = bank.result;
  const localRows =
    bankLocalPreviewAvailable() &&
    ["shared", "recent"].includes(bank.scope) &&
    schoolResult?.page === 1
      ? (window.sikapCollaboration?.published(bank.filters) || []).map((r) => ({
          ...r,
          id: "collaboration:" + r.id,
          localCollaboration: true,
          creator: r.credits[0],
          state: "approved",
          filename: r.filename + " (preview)",
          type: {
            pdf: "application/pdf",
            mp4: "video/mp4",
            mp3: "audio/mpeg",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }[r.type],
        }))
      : [];
  const result = schoolResult
    ? {
        ...schoolResult,
        items: [...schoolResult.items, ...localRows],
        total: schoolResult.total + localRows.length,
      }
    : null;
  if (!result?.items.length)
    return `<div class="bank-empty"><h2>${bank.scope === "review" ? "No resources are waiting for review" : "No resources found"}</h2><p>${Object.keys(bank.filters).length ? "No resources match these filters." : bank.scope === "shared" ? "Approved Project SIKAP resources will appear here." : bank.scope === "mine" ? "Your resource submissions and drafts will appear here." : "Resources will appear here when available."}</p>${bank.scope === "mine" ? '<button class="secondary" onclick="bankUploadPage()">Upload resource</button>' : ""}</div>`;
  const showStatus = !["shared", "recent"].includes(bank.scope);
  const rows = result.items
    .map(
      (resource) =>
        `<tr onclick="if(!event.target.closest('button,a,summary,details'))bankOpen('${resource.id}')"><td><div class="bank-file-name">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}<div><button onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button><small>${esc(resource.term)} · ${resource.filename ? esc(resource.filename) : "Draft"}${resource.saved ? " · Saved" : ""}</small></div></div></td><td data-label="Category">${esc(resource.category[0] + resource.category.slice(1).toLowerCase())}</td><td data-label="Learning area">${esc(resource.subject)}</td><td data-label="Grade">${esc(resource.grade)}</td><td data-label="Creator">${esc(resource.creator)}${resource.credits?.length ? `<small class="bank-contributor-credit">Contributors: ${esc(resource.credits.join(", "))}</small>` : ""}</td><td data-label="Modified">${date(resource.updated)}</td>${showStatus ? `<td>${bankBadge(resource)}</td>` : ""}<td>${bankActions(resource)}</td></tr>`,
    )
    .join("");
  const grid = result.items
    .map(
      (resource) =>
        `<article class="bank-grid-file"><div class="bank-grid-top">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}${bankActions(resource)}</div><button class="bank-grid-title" onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button><p>${esc(resource.category)} · ${esc(resource.subject)}</p><small>${esc(resource.creator)}</small>${showStatus ? bankBadge(resource) : ""}</article>`,
    )
    .join("");
  return `${bank.layout === "board" ? bankBoard(result.items) : bank.layout === "grid" ? `<div class="bank-grid">${grid}</div>` : `<table class="bank-table"><thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Learning area</th><th scope="col">Grade</th><th scope="col">Creator</th><th scope="col">Modified</th>${showStatus ? '<th scope="col">Status</th>' : ""}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table>`}<div class="bank-pagination"><span>${(result.page - 1) * 25 + 1}–${Math.min(result.page * 25, result.total)} of ${result.total}</span><button class="icon-btn" aria-label="Previous page" ${result.page === 1 ? "disabled" : ""} onclick="bankPage(${result.page - 1})">${ico("chevron_left")}</button><button class="icon-btn" aria-label="Next page" ${result.page * 25 >= schoolResult.total ? "disabled" : ""} onclick="bankPage(${result.page + 1})">${ico("chevron_right")}</button></div>`;
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

function bankLocalPreviewAvailable() {
  return (
    typeof location !== "undefined" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)
  );
}
async function bankCollaborationPage(resourceId = null, published = false) {
  if (!bankLocalPreviewAvailable() || !(await bankDiscard())) return;
  try {
    await bankLoadCollaboration();
    view = "bank";
    bank.screen = "collaboration";
    bankRender();
    if (resourceId) window.sikapCollaboration.open(resourceId, published);
    window.scrollTo(0, 0);
  } catch (error) {
    toast(error.message);
  }
}

let bankCollaborationLoading = null;
function bankLoadCollaboration() {
  if (window.sikapCollaboration) return Promise.resolve();
  if (!bankCollaborationLoading)
    bankCollaborationLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "collaboration-preview.js";
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        bankCollaborationLoading = null;
        reject(
          new Error(
            "The collaboration preview could not load. Refresh and try again.",
          ),
        );
      };
      document.head.append(script);
    });
  return bankCollaborationLoading;
}
async function bankPaintCollaboration() {
  if (!bankLocalPreviewAvailable()) return;
  const target = document.querySelector("#bank-collaboration-published");
  if (!target || !["shared", "recent"].includes(bank.scope)) {
    if (target) target.textContent = "";
    return;
  }
  try {
    await bankLoadCollaboration();
    if (!target.isConnected || bank.screen !== "list") return;
    const rows = window.sikapCollaboration.published(bank.filters);
    target.textContent = rows.length
      ? "Local preview: sample collaboration resources are included in this list. They reset on reload."
      : "";
    const results = document.querySelector("#bank-results");
    if (results) results.innerHTML = bankResults();
  } catch {
    if (target.isConnected)
      target.textContent =
        "Collaboration preview unavailable. Open Collaboration to try again.";
  }
}
