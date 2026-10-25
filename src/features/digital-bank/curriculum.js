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
    return `<label class="bank-form-field bank-form-wide">Learning competency<textarea name="competency" required maxlength="3000">${esc(resource.bank_competency || "")}</textarea></label>`;
  return `<div class="bank-form-field bank-form-wide"><label for="competency-search">Learning competency</label><input id="competency-search" type="search" placeholder="Search competency text or official code" maxlength="300" oninput="curriculumSearch()"><label for="competency-select" class="muted">Choose learning competency</label><select id="competency-select" name="competency_id" required onchange="curriculumChoose(this.value)"><option value="">Choose grade, learning area and quarter first</option></select><div id="competency-options-state" class="muted" role="status"></div><div id="competency-selected" class="bank-prose"></div><div><button class="bank-text-button" type="button" id="competency-prev" onclick="curriculumPage(-1)" hidden>Previous options</button><button class="bank-text-button" type="button" id="competency-next" onclick="curriculumPage(1)" hidden>More options</button></div></div>`;
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
      : "No matching competencies are available for this selection.";
    $("#competency-prev").hidden = curriculum.page <= 1;
    $("#competency-next").hidden = curriculum.page * 50 >= result.total;
    curriculumPaintSelection();
  } catch (error) {
    if (sequence !== curriculum.sequence || !select.isConnected) return;
    select.innerHTML =
      '<option value="">Competency choices unavailable</option>';
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
      throw Error("Enter the learning competency.");
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
