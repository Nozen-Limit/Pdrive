// The fixed JHS areas follow the nine relevant guides linked by DepEd.
// Guide links are references, not an automatically verified competency catalog.
const curriculumGuides = [
  [
    "Araling Panlipunan",
    "1-FINAL-MATATAG-Araling-Panlipunan-CG-2023-Grades-4-10.pdf",
  ],
  ["English", "2-FINAL-MATATAG-English-CG-2023-Grades-2-10-withAppendices.pdf"],
  ["Filipino", "4-FINAL-MATATAG-FILIPINO-CG-2023-Grades-2-10.pdf"],
  ["Mathematics", "9-FINAL-MATATAG-Mathematics-CG-2023-Grades-1-10.pdf"],
  ["Science", "13-FINAL-MATATAG-Science-CG-2023-Grades-3-10.pdf"],
  [
    "Technology and Livelihood Education",
    "3-FINAL-MATATAG-EPP_TLE-CG-2023-Grades-4-10.pdf",
  ],
  ["Music and Arts", "10-FINAL-MATATAG-Music-and-Arts-CG-2023-Grades-4-10.pdf"],
  [
    "Physical Education and Health",
    "11-FINAL-MATATAG-PE-and-Health-CG-2023-Grades-4-10.pdf",
  ],
  ["Values Education", "5-FINAL-MATATAG-GMRC-and-VE-CG-2023-Grades-1-10.pdf"],
];
const curriculumGrades = [7, 8, 9, 10].map((n) => "Grade " + n);
const curriculumQuarters = [1, 2, 3, 4].map((n) => "Quarter " + n);
const curriculum = {
  account: null,
  config: null,
  sequence: 0,
  selected: null,
  rows: [],
  page: 1,
  total: 0,
  filters: { status: "draft" },
  result: null,
  review: null,
  error: "",
  coverage: null,
};
function curriculumResetAccount() {
  if (curriculum.account === data.user.id) return;
  Object.assign(curriculum, {
    account: data.user.id,
    config: null,
    selected: null,
    rows: [],
    result: null,
    review: null,
    coverage: null,
    filters: { status: "draft" },
    page: 1,
  });
  curriculum.sequence++;
}
async function curriculumPrepare(resource = {}) {
  curriculumResetAccount();
  curriculum.config = await bankApi().curriculum();
  curriculum.selected = resource.bank_competency_id
    ? await bankApi().competency(resource.bank_competency_id)
    : null;
  curriculum.rows = [];
  curriculum.page = 1;
}
function curriculumAreaNames() {
  return (
    curriculum.config?.learning_areas || curriculumGuides.map(([name]) => name)
  );
}
function curriculumFields(resource) {
  if (curriculumLegacyRollout())
    return `<label class="bank-form-field bank-form-wide">Learning competency<textarea name="competency" required maxlength="3000">${esc(resource.bank_competency || "")}</textarea><small class="muted">The verified catalog is not ready yet. This entry will be marked Legacy until a head teacher maps it to a verified competency.</small></label>`;
  return `<div class="bank-form-field bank-form-wide"><label for="competency-search">Learning competency</label><input id="competency-search" type="search" placeholder="Search competency text or official code" maxlength="300" oninput="curriculumSearch()"><label for="competency-select" class="muted">Choose a competency from the verified catalog</label><select id="competency-select" name="competency_id" required onchange="curriculumChoose(this.value)"><option value="">Choose grade, learning area and quarter first</option></select><div id="competency-options-state" class="muted" role="status"></div><div id="competency-selected" class="bank-prose"></div><div><button class="bank-text-button" type="button" id="competency-prev" onclick="curriculumPage(-1)" hidden>Previous options</button><button class="bank-text-button" type="button" id="competency-next" onclick="curriculumPage(1)" hidden>More options</button></div>${resource.bank_competency_legacy ? `<p class="muted">Legacy competency: ${esc(resource.bank_competency)}. Choose a verified entry before saving this resource.</p>` : ""}</div>`;
}
function curriculumLegacyRollout() {
  return curriculum.config?.verified_count === 0 && !curriculum.config.enforced;
}
let curriculumSearchTimer;
function curriculumSearch() {
  clearTimeout(curriculumSearchTimer);
  curriculum.sequence++;
  curriculumSearchTimer = setTimeout(() => {
    curriculum.page = 1;
    curriculumLoadOptions();
  }, 250);
}
function curriculumMatches(row, fields) {
  return (
    row?.status === "verified" &&
    row.grade === fields.grade &&
    row.learning_area === fields.subject &&
    (!row.quarter || row.quarter === fields.term)
  );
}
function curriculumFormFilters() {
  const form = $(".bank-resource-form");
  if (!form) return null;
  const fields = Object.fromEntries(new FormData(form));
  return {
    grade: fields.grade,
    subject: fields.subject,
    term: fields.term,
    q: $("#competency-search")?.value || "",
    status: "verified",
  };
}
function curriculumFormChanged() {
  curriculum.selected = null;
  curriculum.rows = [];
  curriculum.page = 1;
  if ($("#competency-search")) $("#competency-search").value = "";
  curriculumLoadOptions();
}
async function curriculumLoadOptions() {
  const fields = curriculumFormFilters(),
    select = $("#competency-select"),
    state = $("#competency-options-state");
  if (!fields || !select) return;
  const sequence = ++curriculum.sequence,
    account = data.user.id;
  select.disabled = true;
  select.innerHTML = '<option value="">Loading competencies…</option>';
  $("#competency-selected").textContent = "";
  $("#competency-prev").hidden = true;
  $("#competency-next").hidden = true;
  if (!fields.grade || !fields.subject || !fields.term) {
    select.innerHTML =
      '<option value="">Choose grade, learning area and quarter first</option>';
    state.textContent = "";
    return;
  }
  state.textContent = "Loading verified competencies…";
  try {
    const result = await bankApi().competencies(fields, curriculum.page);
    if (
      sequence !== curriculum.sequence ||
      !select.isConnected ||
      data.user.id !== account
    )
      return;
    curriculum.rows = result.items;
    if (!curriculumMatches(curriculum.selected, fields))
      curriculum.selected = null;
    const rows = [...result.items];
    if (
      curriculum.selected &&
      !rows.some((row) => row.id === curriculum.selected.id)
    )
      rows.unshift(curriculum.selected);
    select.innerHTML =
      '<option value="">Choose learning competency</option>' +
      rows
        .map(
          (row) =>
            `<option value="${esc(row.id)}" ${row.id === curriculum.selected?.id ? "selected" : ""}>${esc((row.official_code ? row.official_code + " · " : "") + row.competency_text)}</option>`,
        )
        .join("");
    select.disabled = false;
    state.textContent = result.total
      ? `${result.total} matching verified competencies${result.total > 50 ? " · Search to narrow the options" : ""}.`
      : "No verified competencies match. A head teacher must add and verify entries from the applicable DepEd guide.";
    $("#competency-prev").hidden = curriculum.page <= 1;
    $("#competency-next").hidden = curriculum.page * 50 >= result.total;
    curriculumPaintSelection();
  } catch (error) {
    if (sequence !== curriculum.sequence || !select.isConnected) return;
    select.innerHTML = '<option value="">Catalog unavailable</option>';
    state.textContent = bankMessage(error);
  }
}
function curriculumPage(direction) {
  curriculum.page = Math.max(1, curriculum.page + direction);
  curriculumLoadOptions();
}
function curriculumChoose(id) {
  curriculum.selected =
    curriculum.rows.find((row) => row.id === id) ||
    (curriculum.selected?.id === id ? curriculum.selected : null);
  curriculumPaintSelection();
  dirty = true;
}
function curriculumSource(row) {
  const valid = /^https:\/\//.test(row.source_url || "");
  return `${valid ? `<a href="${esc(row.source_url)}" target="_blank" rel="noopener noreferrer">${esc(row.source_title)}</a>` : esc(row.source_title)}${row.source_page ? " · PDF page " + esc(row.source_page) : ""} · ${esc(row.curriculum_version)}`;
}
function curriculumPaintSelection() {
  const row = curriculum.selected;
  $("#competency-selected").innerHTML = row
    ? `<p>${esc(row.competency_text)}</p><small>${row.official_code ? "Official code: " + esc(row.official_code) : "No official code supplied in this catalog entry."}<br>${curriculumSource(row)}</small>`
    : "";
}
function curriculumValidateFields(fields) {
  if (
    !curriculumAreaNames().includes(fields.subject) ||
    !curriculumGrades.includes(fields.grade) ||
    !curriculumQuarters.includes(fields.term)
  )
    throw Error("Choose a listed learning area, Grade 7–10 and quarter.");
  if (curriculumLegacyRollout()) {
    if (!fields.competency?.trim())
      throw Error(
        "Enter the learning competency while the catalog is being prepared.",
      );
    delete fields.competency_id;
    return;
  }
  if (
    !fields.competency_id ||
    fields.competency_id !== curriculum.selected?.id ||
    !curriculumMatches(curriculum.selected, fields)
  )
    throw Error(
      "Choose a verified learning competency matching the selected grade, learning area and quarter.",
    );
  fields.competency = curriculum.selected.competency_text;
}
function curriculumGuideTable() {
  return `<details><summary>DepEd learning areas · Grades 7–10</summary><p class="muted">The same nine learning areas are available for Grade 7, Grade 8, Grade 9 and Grade 10. Use the grade-specific section of each guide. Quarter 1–4 remain resource tags; an unspecified source quarter is not guessed.</p><div class="overview-summary-scroll"><table class="overview-summary-table"><thead><tr><th>Learning area</th><th>Grades</th><th>Official source</th></tr></thead><tbody>${curriculumGuides.map(([name, file]) => `<tr><td>${esc(name)}</td><td>7, 8, 9, 10</td><td><a href="https://www.deped.gov.ph/wp-content/uploads/${file}" target="_blank" rel="noopener noreferrer">DepEd MATATAG guide (2023)</a></td></tr>`).join("")}</tbody></table></div><p class="muted">TLE includes ICT, Agriculture and Fishery Arts, Family and Consumer Science, and Industrial Arts. Music and Arts, and Physical Education and Health use separate guides. Values Education is the JHS area; GMRC is the elementary section of its guide. These references do not certify an imported competency or the school’s applicable curriculum edition.</p><a href="https://www.deped.gov.ph/revised-k-to-10-curriculum/" target="_blank" rel="noopener noreferrer">DepEd curriculum source page</a></details>`;
}
async function curriculumCatalogPage() {
  if (data.user.role !== "head" || busy || !(await bankDiscard())) return;
  curriculumResetAccount();
  view = "bank";
  bank.screen = "curriculum";
  curriculum.error = "";
  curriculum.result = null;
  render();
  await curriculumCatalogRead();
}
async function curriculumCatalogRead() {
  const account = data.user.id,
    sequence = ++curriculum.sequence;
  try {
    const [config, result, coverage] = await Promise.all([
      bankApi().curriculum(),
      bankApi().competencies(curriculum.filters, curriculum.page),
      bankApi().competencyCoverage(),
    ]);
    if (account !== data.user.id || sequence !== curriculum.sequence) return;
    Object.assign(curriculum, { config, result, coverage, error: "" });
  } catch (error) {
    if (sequence === curriculum.sequence) curriculum.error = bankMessage(error);
  }
  if (bank.screen === "curriculum" && account === data.user.id) render();
}
function curriculumCatalogContent() {
  if (data.user.role !== "head") return "";
  const options = (items, selected) =>
    '<option value="">All</option>' +
    items
      .map(
        (item) =>
          `<option ${item === selected ? "selected" : ""}>${esc(item)}</option>`,
      )
      .join("");
  const result = curriculum.result;
  const coverage = curriculum.coverage;
  return `<div class="bank-page-heading"><h1>Curriculum catalog</h1></div>${curriculumGuideTable()}<p class="muted">Import source-checked competencies for resource tagging. Imports start as drafts. Only verified entries appear in the upload form.</p>${coverage ? `<p>${coverage.verified_competencies} verified competencies · ${coverage.catalog_empty ? "Coverage is unavailable until the catalog has verified entries." : coverage.without_approved_resource + " competencies have no approved resource yet. Counts cover the verified catalog only."}</p>` : ""}${curriculum.config ? `<p class="muted">Server enforcement: ${curriculum.config.enforced ? "On" : "Off during rollout. The administrator must activate enforcement after verified entries are available."}</p>` : ""}${curriculumAddForm()}<details><summary>Import a prepared catalog file</summary><form class="bank-resource-form" onsubmit="curriculumImport(event)"><h2>Import competencies</h2><p class="muted">Use a prepared JSON catalog, up to 500 entries / 3 MB. See the administrator setup guide for its format. Imported entries still require source review.</p><label class="bank-form-field">Catalog JSON file<input name="catalog" type="file" accept=".json,application/json" required onchange="curriculumPreviewImport(this)"></label><div id="curriculum-import-preview" role="status"></div><p class="form-error" role="alert"></p><button class="secondary" type="submit">Import as drafts</button></form></details><form class="bank-resource-form" data-no-dirty onsubmit="curriculumFilter(event)"><div class="bank-form-grid"><label class="bank-form-field">Search<input name="q" maxlength="300" value="${esc(curriculum.filters.q || "")}"></label><label class="bank-form-field">Status<select name="status">${options(["draft", "verified", "retired"], curriculum.filters.status)}</select></label><label class="bank-form-field">Grade<select name="grade">${options(curriculumGrades, curriculum.filters.grade)}</select></label><label class="bank-form-field">Learning area<select name="subject">${options(curriculumAreaNames(), curriculum.filters.subject)}</select></label></div><button class="secondary">Apply filters</button></form>${curriculum.error ? `<p role="alert">${esc(curriculum.error)}</p>` : result ? `<p>${result.total} entries · Page ${curriculum.page}</p><div class="overview-summary-scroll"><table class="overview-summary-table"><thead><tr><th>Competency</th><th>Learning area</th><th>Grade / quarter</th><th>Status</th><th></th></tr></thead><tbody>${result.items.map((row) => `<tr><td>${row.official_code ? `<strong>${esc(row.official_code)}</strong><br>` : ""}${esc(row.competency_text)}</td><td>${esc(row.learning_area)}</td><td>${esc(row.grade)}<br>${esc(row.quarter || "Quarter not specified")}</td><td>${esc(row.status)}</td><td><button class="bank-text-button" onclick="curriculumReviewPage('${row.id}')">Review entry</button></td></tr>`).join("") || '<tr><td colspan="5">No entries match these filters.</td></tr>'}</tbody></table></div><button class="secondary" onclick="curriculumCatalogPageNumber(-1)" ${curriculum.page <= 1 ? "disabled" : ""}>Previous</button> <button class="secondary" onclick="curriculumCatalogPageNumber(1)" ${curriculum.page * 50 >= result.total ? "disabled" : ""}>Next</button>` : '<p role="status">Loading catalog…</p>'}`;
}
function curriculumFilter(event) {
  event.preventDefault();
  curriculum.filters = Object.fromEntries(new FormData(event.target));
  curriculum.page = 1;
  curriculumCatalogRead();
}
function curriculumCatalogPageNumber(direction) {
  curriculum.page = Math.max(1, curriculum.page + direction);
  curriculumCatalogRead();
}
async function curriculumReadImport(file) {
  if (!file || file.size > 3000000)
    throw Error("Choose a JSON file up to 3 MB.");
  let entries;
  try {
    entries = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
  } catch {
    throw Error("The selected file must contain a valid JSON array.");
  }
  if (!Array.isArray(entries) || !entries.length || entries.length > 500)
    throw Error("Import 1 to 500 competency entries at a time.");
  for (const row of entries) {
    if (
      !row ||
      !curriculumAreaNames().includes(row.learning_area) ||
      !curriculumGrades.includes(row.grade) ||
      (row.quarter && !curriculumQuarters.includes(row.quarter)) ||
      ![
        "competency_text",
        "curriculum_version",
        "source_title",
        "source_url",
        "source_page",
      ].every((key) => typeof row[key] === "string" && row[key].trim()) ||
      !/^https:\/\//.test(row.source_url)
    )
      throw Error(
        "Each entry needs a listed grade/area, valid quarter if specified, competency text and complete HTTPS source details.",
      );
  }
  return entries;
}
async function curriculumPreviewImport(input) {
  const target = $("#curriculum-import-preview");
  try {
    const rows = await curriculumReadImport(input.files[0]);
    if (target.isConnected) {
      target.textContent = `${rows.length} entries ready to import as drafts. First entry: ${rows[0].grade} · ${rows[0].learning_area} · ${rows[0].competency_text}`;
    }
  } catch (error) {
    if (target.isConnected) target.textContent = error.message;
  }
}
async function curriculumImport(event) {
  await bankRunForm(event, async (form) => {
    const rows = await curriculumReadImport(form.elements.catalog.files[0]);
    const result = await bankApi().importCompetencies(rows);
    toast(
      `${result.imported} imported as drafts · ${result.duplicates} duplicates skipped.`,
    );
    dirty = false;
    curriculum.page = 1;
    curriculum.filters = { status: "draft" };
    await curriculumCatalogRead();
  });
}
async function curriculumReviewPage(id) {
  if (data.user.role !== "head") return;
  try {
    curriculum.review = await bankApi().competency(id);
    if (!curriculum.review)
      throw Error("Refresh the catalog; this entry is unavailable.");
    bank.screen = "competency-review";
    render();
  } catch (error) {
    toast(bankMessage(error));
  }
}
function curriculumReviewContent() {
  const row = curriculum.review;
  if (data.user.role !== "head" || !row) return "";
  return `<button class="bank-text-button" onclick="curriculumCatalogPage()">Back to catalog</button><div class="bank-page-heading"><h1>Review competency</h1></div><p>${esc(row.grade)} · ${esc(row.learning_area)} · ${esc(row.quarter || "Quarter not specified")} · ${esc(row.status)}</p><p class="bank-prose">${esc(row.competency_text)}</p><p>${row.official_code ? "Official code: " + esc(row.official_code) : "No official code supplied. The internal SIKAP ID is not a DepEd code."}</p><p>${curriculumSource(row)}</p><form class="bank-resource-form" onsubmit="curriculumReviewSubmit(event)"><label class="bank-form-field">Source-check note<textarea name="note" maxlength="2000" required></textarea></label><label><input name="source_checked" type="checkbox"> I checked the wording, grade, learning area, edition, page, quarter and official code (where provided) against the source, and confirmed the edition applies to our school.</label><p class="form-error" role="alert"></p><div class="form-actions"><button class="secondary" name="decision" value="draft">Keep as draft</button><button class="secondary" name="decision" value="retired">Retire entry</button><button class="primary" name="decision" value="verified">Verify for uploads</button></div></form>`;
}
async function curriculumReviewSubmit(event) {
  const decision = event.submitter?.value;
  await bankRunForm(event, async (form) => {
    if (decision === "verified" && !form.elements.source_checked.checked)
      throw Error(
        "Complete the source check before verifying this competency.",
      );
    await bankApi().reviewCompetency({
      cid: curriculum.review.id,
      expected_revision: curriculum.review.revision,
      decision,
      note: form.elements.note.value,
    });
    dirty = false;
    bank.screen = "curriculum";
    await curriculumCatalogRead();
    toast("Competency status updated.");
  });
}

function curriculumAddForm() {
  const select = (name, title, items) =>
    `<label class="bank-form-field">${title}<select name="${name}" required><option value="">Choose ${title.toLowerCase()}</option>${items.map((item) => `<option>${esc(item)}</option>`).join("")}</select></label>`;
  return `<details><summary>Add a competency from a DepEd guide</summary><form class="bank-resource-form" onsubmit="curriculumAdd(event)"><p class="muted">Copy the exact competency wording from the appropriate grade section. Save it as a draft, then check its source before verifying it for uploads.</p><div class="bank-form-grid">${select("learning_area", "Learning area", curriculumAreaNames())}${select("grade", "Grade", curriculumGrades)}<label class="bank-form-field">Quarter in the guide<select name="quarter"><option value="">Not specified by the source</option>${curriculumQuarters.map((q) => `<option>${q}</option>`).join("")}</select></label><label class="bank-form-field">Official code (if printed)<input name="official_code" maxlength="100"></label><label class="bank-form-field bank-form-wide">Learning competency<textarea name="competency_text" required maxlength="3000"></textarea></label><label class="bank-form-field">Curriculum edition<input name="curriculum_version" required maxlength="200" placeholder="e.g. MATATAG, August 2023"></label><label class="bank-form-field">Guide title<input name="source_title" required maxlength="300"></label><label class="bank-form-field">Official guide link<input name="source_url" type="url" pattern="https://.*" required maxlength="2000"></label><label class="bank-form-field">PDF page<input name="source_page" required maxlength="60"></label></div><p class="form-error" role="alert"></p><button class="secondary">Save competency draft</button></form></details>`;
}
async function curriculumAdd(event) {
  await bankRunForm(event, async (form) => {
    const entry = Object.fromEntries(new FormData(form));
    entry.quarter ||= null;
    entry.official_code ||= null;
    const result = await bankApi().importCompetencies([entry]);
    dirty = false;
    curriculum.page = 1;
    curriculum.filters = { status: "draft" };
    await curriculumCatalogRead();
    toast(
      result.imported
        ? "Competency draft added. Review its source to verify it for uploads."
        : "This competency is already in the catalog.",
    );
  });
}
