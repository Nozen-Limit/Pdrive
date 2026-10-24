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
      : "This resource will return to its previous review status. Approved resources will become available in the shared Digital Bank again.",
    async () => {
      try {
        await bankApi().archive({
          mid: id,
          expected_revision: revision,
          archive,
        });
        if (view === "dashboard") await overviewRead();
        else if (bank.screen === "detail") await bankOpen(id);
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
