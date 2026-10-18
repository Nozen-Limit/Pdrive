function noteActions(n) {
  return `<button class="action-btn" onclick="pinNote('${n.id}')">${n.pinned ? "Unpin" : "Pin"}</button><button class="action-btn" onclick="noteModal('${n.id}')">Edit</button><button class="action-btn" onclick="deleteNote('${n.id}')">Delete</button>`;
}
function notesPage() {
  return `<div class="toolbar"><p class="muted">Your private notes</p><button class="primary" onclick="noteModal()">New note</button></div><div class="cards notes-grid">${data.notes.map((n) => `<article class="panel note-panel" tabindex="0"><div class="note-top"><h3>${esc(n.title)}</h3>${n.pinned ? '<span class="pin">Pinned</span>' : ""}<details class="mobile-more note-more"><summary aria-label="Actions for ${esc(n.title)}">${ico("more_horiz")}</summary><div class="more-actions">${noteActions(n)}</div></details></div><p class="note-body">${esc(n.body)}</p><div class="note-actions desktop-note-actions">${noteActions(n)}</div></article>`).join("") || '<div class="panel empty"><h3>No notes yet</h3><p>Create a note to keep your checklist or lesson ideas nearby.</p></div>'}</div>`;
}
function noteModal(nid) {
  const n = data.notes.find((n) => n.id === nid);
  $("#modalRoot").innerHTML =
    `<div class="overlay show" onclick="closeModal()"></div><section class="modal" role="dialog" aria-modal="true" aria-labelledby="note-title"><div class="modal-head"><h2 id="note-title">${n ? "Edit note" : "New note"}</h2><button class="close" onclick="closeModal()" aria-label="Close">×</button></div><form onsubmit="saveNote(event,'${nid || ""}')"><div class="field"><label for="note-name">Title</label><input id="note-name" name="title" value="${esc(n?.title)}" maxlength="160" required></div><div class="field"><label for="note-body">Note</label><textarea id="note-body" name="body" maxlength="5000" required>${esc(n?.body)}</textarea></div><label class="checkbox-label"><input name="pinned" type="checkbox" ${n?.pinned ? "checked" : ""}> Pin this note</label><p class="form-error" role="alert"></p><div class="form-actions"><button class="secondary" type="button" onclick="closeModal()">Cancel</button><button class="primary" type="submit">Save note</button></div></form></section>`;
  $("#note-name").focus();
}
function closeModal() {
  const root = $("#modalRoot");
  if (
    root?.querySelector("form") &&
    dirty &&
    !confirm("Discard your unsaved changes?")
  )
    return;
  if (root) {
    root.innerHTML = "";
    dirty = false;
  }
}
async function saveNote(e, nid) {
  await formSave(e, async (form) => {
    const f = new FormData(form);
    await api(nid ? "notes/" + nid : "notes", {
      method: nid ? "PATCH" : "POST",
      body: JSON.stringify({
        title: f.get("title"),
        body: f.get("body"),
        pinned: f.has("pinned"),
      }),
    });
    toast("Note saved.");
  });
}
async function pinNote(nid) {
  try {
    const n = data.notes.find((n) => n.id === nid);
    await api("notes/" + nid, {
      method: "PATCH",
      body: JSON.stringify({ ...n, pinned: !n.pinned }),
    });
    data = await api("state");
    render();
  } catch (e) {
    toast(e.message);
  }
}
async function deleteNote(nid) {
  if (!confirm("Delete this note? This cannot be undone.")) return;
  try {
    await api("notes/" + nid, { method: "DELETE" });
    data = await api("state");
    render();
    toast("Note deleted.");
  } catch (e) {
    toast(e.message);
  }
}
function notificationsPage() {
  const unread = data.notifications.some((n) => !n.read);
  return `<div class="panel"><div class="panel-head"><h2>Notifications</h2><button class="secondary" onclick="markNotificationsRead()" ${unread ? "" : "disabled"}>Mark all as read</button></div><div class="module-list">${data.notifications.map((n) => `<button class="module-row notification-row" onclick="openNotification('${n.id}')"><span>${!n.read ? "<strong>Unread</strong> · " : ""}${esc(n.body)}<small class="module-meta">${date(n.created)}</small></span>${ico("chevron_right")}</button>`).join("") || '<div class="empty">No notifications yet.</div>'}</div></div>`;
}
async function markNotificationsRead() {
  if (busy) return;
  busy = true;
  try {
    await api("notifications", { method: "PATCH", body: "{}" });
    data = await api("state");
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
async function openNotification(nid) {
  const n = data.notifications.find((n) => n.id === nid);
  if (n?.module) await openModule(n.module);
  else if (n?.requirement_id) await go("requirements");
}
