const overview = {
  items: [],
  ready: false,
  loading: false,
  error: "",
  sequence: 0,
  screen: "resources",
};
async function overviewRead() {
  if (!data || data.user.approval_status !== "approved") return;
  const sequence = ++overview.sequence,
    account = data.user.id + ":" + data.user.role;
  overview.items = [];
  overview.ready = false;
  overview.error = "";
  overview.loading = true;
  render();
  try {
    const items = new Map();
    let result,
      page = 1;
    do {
      result = await bankApi().list(
        { scope: data.user.role === "head" ? "all" : "mine", sort: "oldest" },
        page,
      );
      if (
        sequence !== overview.sequence ||
        !data ||
        account !== data.user.id + ":" + data.user.role
      )
        return;
      for (const row of result.items) items.set(row.id, row);
      if (items.size < result.total && (!result.items.length || page >= 100000))
        throw Error(
          "Resources changed while loading. Refresh the overview to try again.",
        );
      page++;
    } while (items.size < result.total);
    overview.items = [...items.values()]
      .filter(
        (r) =>
          !r.archived &&
          !r.bank_draft &&
          !["draft", "archived"].includes(r.state),
      )
      .map((r) => ({
        ...r,
        status: r.state === "resubmitted" ? "pending" : r.state,
        teacher: r.creator || "Teacher",
      }));
    overview.ready = true;
  } catch (error) {
    if (sequence === overview.sequence) overview.error = bankMessage(error);
  } finally {
    if (sequence === overview.sequence) {
      overview.loading = false;
      if (view === "dashboard") render();
    }
  }
}
function overviewState() {
  if (overview.loading || (!overview.ready && !overview.error))
    return '<p class="overview-muted" role="status">Loading Digital Bank resources…</p>';
  if (overview.error)
    return `<p class="overview-muted" role="alert">${esc(overview.error)}</p><button class="bank-text-button" onclick="overviewRead()">Try again</button>`;
  return "";
}
function overviewSummaryData() {
  const teachers = new Map(),
    areas = new Map();
  for (const t of data.teachers || [])
    if (t.role !== "head" && t.approval_status === "approved")
      teachers.set(t.id, {
        id: t.id,
        name: t.name,
        submitted: 0,
        approved: 0,
        pending: 0,
        returned: 0,
      });
  for (const r of overview.items) {
    if (!teachers.has(r.owner))
      teachers.set(r.owner, {
        id: r.owner,
        name: r.creator || "Teacher",
        submitted: 0,
        approved: 0,
        pending: 0,
        returned: 0,
      });
    const t = teachers.get(r.owner);
    t.submitted++;
    if (["approved", "pending", "returned"].includes(r.status)) t[r.status]++;
    if (!areas.has(r.subject)) areas.set(r.subject, 0);
    if (r.status === "approved") areas.set(r.subject, areas.get(r.subject) + 1);
  }
  return {
    teachers: [...teachers.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    ),
    areas: [...areas.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}
function overviewSummaryPage() {
  if (data.user.role !== "head") return;
  overview.screen = "summary";
  render();
}
function overviewSummaryContent() {
  if (data.user.role !== "head") return "";
  const state = overviewState();
  if (state) return state;
  const summary = overviewSummaryData();
  const table = (headers, rows) =>
    `<div class="overview-summary-scroll"><table class="overview-summary-table"><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell, i) => (i ? `<td>${esc(cell)}</td>` : `<th scope="row">${esc(cell)}</th>`)).join("")}</tr>`).join("") || `<tr><td colspan="${headers.length}">No submitted resources yet.</td></tr>`}</tbody></table></div>`;
  return `<div class="overview-summary-heading"><p class="overview-muted">Digital Bank submissions. Drafts and archived resources are excluded. Pending includes resubmissions.</p><button class="bank-text-button" onclick="overviewRead()">${ico("refresh")}Refresh</button></div><section class="overview-summary-section"><h2>Resources per teacher</h2>${table(
    ["Teacher", "Submitted", "Approved", "Pending", "Returned"],
    summary.teachers.map((t) => [
      t.name,
      t.submitted,
      t.approved,
      t.pending,
      t.returned,
    ]),
  )}</section><section class="overview-summary-section"><h2>Approved resources per learning area</h2>${table(
    ["Learning area", "Approved"],
    summary.areas.map(([name, count]) => [name, count]),
  )}</section>`;
}
async function overviewOpen(id) {
  bank.scope = data.user.role === "head" ? "all" : "mine";
  bank.filters = {};
  await bankOpen(id);
}
function overviewList() {
  const resources = filtered();
  return `<div class="panel-head"><span class="muted">${resources.length} resources</span></div><div class="module-list">${resources.map((r) => `<div class="module-row"><div><button class="module-title text-button" onclick="overviewOpen('${r.id}')">${esc(r.title)}</button><div class="module-meta">${esc(r.category)} · ${esc(r.subject)} · ${esc(r.grade)} · ${esc(r.term)} · v${r.version}</div><div class="module-meta">${esc(r.creator)} · Updated ${date(r.updated)}</div></div><div class="row-actions">${badge(r.status)}<button class="action-btn" onclick="overviewOpen('${r.id}')">Open</button></div></div>`).join("") || '<div class="empty"><h3>No resources here yet</h3><p>Digital Bank submissions will appear here.</p></div>'}</div>`;
}
function overviewBankCounts() {
  const ready = overview.ready && !overview.loading && !overview.error;
  return `<div class="overview-requirement-counts">${[
    ["", "Submitted"],
    ["pending", "Pending"],
    ["returned", "Returned"],
    ["approved", "Approved"],
  ]
    .map(
      ([state, title]) =>
        `<span><strong>${ready ? overview.items.filter((r) => !state || r.status === state).length : "—"}</strong>${title}</span>`,
    )
    .join(
      "",
    )}</div>${data.user.role === "head" ? '<button class="bank-text-button" onclick="overviewSummaryPage()">View teacher summary</button>' : ""}`;
}
function overviewRecent() {
  if (!overview.ready || overview.loading || overview.error)
    return '<p class="overview-muted">No resource updates.</p>';
  return (
    [...overview.items]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, 4)
      .map(
        (r) =>
          `<article class="overview-note"><button class="bank-text-button" onclick="overviewOpen('${r.id}')">${esc(r.title)}</button><p>${esc(r.creator)} · ${esc(label(r.status))} · ${date(r.updated)}</p></article>`,
      )
      .join("") || '<p class="overview-muted">No resource updates.</p>'
  );
}
