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
  if (view === "bank" && bank.screen === "list") bankPaintCollaboration();
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
  if (bankLocalPreviewAvailable() && id.startsWith("collaboration:"))
    return bankCollaborationPage(id.slice(14), true);
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
  document
    .querySelectorAll(".workspace-app, #modalRoot")
    .forEach((element) => element.setAttribute("style", bankThemeStyle()));
  document
    .querySelectorAll('input[name="bank-theme"]')
    .forEach((input) => (input.checked = input.value === value));
}
