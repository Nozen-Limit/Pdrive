function bankUploadForm() {
  const resource = bank.editing || {},
    edit = bank.editing && !resource.bank_draft;
  const input = (name, title, value, max, multiline = false, required = true) =>
    `<label class="bank-form-field ${multiline ? "bank-form-wide" : ""}">${title}${multiline ? `<textarea name="${name}" maxlength="${max}" ${required ? "required" : ""}>${esc(value || "")}</textarea>` : `<input name="${name}" maxlength="${max}" value="${esc(value || "")}" ${required ? "required" : ""}>`}</label>`;
  const select = (name, title, value, options) =>
    `<label class="bank-form-field">${title}<select name="${name}" required ${["subject", "grade", "term"].includes(name) ? 'onchange="curriculumFormChanged()"' : ""}><option value="">Choose ${title.toLowerCase()}</option>${options.map((option) => `<option ${option === value ? "selected" : ""}>${esc(option)}</option>`).join("")}</select></label>`;
  return `<button class="bank-text-button" onclick="bankBack()">${ico("arrow_back")}Back to resources</button><div class="bank-page-heading"><h1>${edit ? "Edit resource metadata" : resource.id ? "Edit draft" : "Upload resource"}</h1></div><form class="bank-resource-form" onsubmit="bankSubmitForm(event)"><div class="bank-form-grid">${input("title", "Resource title", resource.title, 200)}${select("category", "Category", resource.bank_category, Object.keys(bankCategories))}${select("subject", "Learning area", resource.subject, curriculumAreaNames())}${select(
    "grade",
    "Grade level",
    resource.grade,
    curriculumGrades,
  )}${select(
    "term",
    "Quarter",
    resource.term,
    curriculumQuarters,
  )}<label class="bank-form-field">Creator<input value="${esc(resource.creator || data.user.name)}" readonly></label>${input("description", "Description", resource.bank_description, 5000, true)}${curriculumFields(resource)}${input("localization", "Contextualization / Localization", resource.bank_localization, 5000, true)}${input("tags", "Keywords / Tags (comma separated)", resource.bank_tags?.join(", "), 1000)}${input("source", "Reference / Source (optional)", resource.bank_source, 2000, false, false)}${input("notes", "Additional notes (optional)", resource.bank_notes, 3000, true, false)}</div>${edit ? "" : bankFileInput()}<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="secondary" onclick="bankBack()">Cancel</button>${edit ? '<button type="submit" class="primary" name="action" value="metadata">Save metadata</button>' : '<button type="submit" class="secondary" name="action" value="draft">Save draft</button><button type="submit" class="primary" name="action" value="submit">Submit for review</button>'}</div></form>`;
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
  try {
    await curriculumPrepare();
  } catch (error) {
    toast(bankMessage(error));
    return;
  }
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
    await curriculumPrepare(bank.detail.resource);
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
async function bankMetadataPage() {
  try {
    await curriculumPrepare(bank.detail.resource);
  } catch (error) {
    toast(bankMessage(error));
    return;
  }
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
