function avatarContent(u) {
  return u.avatarUrl
    ? `<img src="${esc(u.avatarUrl)}" data-profile-id="${esc(u.id)}" alt="${esc(u.name)} profile picture" referrerpolicy="no-referrer" onerror="profilePhotoFailed(this)">`
    : esc(
        u.name
          .trim()
          .split(/\s+/)
          .map((x) => x[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      );
}
function profilePhotoFailed(image) {
  if (!data?.user) return;
  const person = [data.user, ...(data.teachers || [])].find(
    (u) => u.id === image.dataset.profileId,
  );
  if (!person) return;
  delete person.avatarUrl;
  person.avatarError =
    "Your picture is saved, but the image could not load. Retry to renew its private link.";
  if (image.parentElement)
    image.parentElement.textContent = person.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  if (person.id === data.user.id && view === "profile") render();
}
async function uploadProfilePhoto(e) {
  if (busy) return;
  const file = e.target.files[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2097152
  ) {
    toast("Choose a JPG, PNG or WebP image up to 2 MB.");
    e.target.value = "";
    return;
  }
  if (dirty && !confirm("Discard unsaved profile changes?")) return;
  busy = true;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    bitmap.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob)
      throw Error("This image could not be processed. Choose another file.");
    const body = new FormData();
    body.set("file", new File([blob], "profile.jpg", { type: "image/jpeg" }));
    const saved = await api("profile/photo", { method: "POST", body });
    Object.assign(data.user, saved);
    dirty = false;
    render();
    try {
      const fresh = await api("state");
      if (!fresh.user.avatar_key && saved.avatar_key)
        Object.assign(fresh.user, saved);
      data = fresh;
    } catch {
      toast("Picture saved. Other profile details could not refresh.");
      return;
    }
    dirty = false;
    render();
    toast(data.user.avatarError || "Profile picture updated.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
    e.target.value = "";
  }
}
async function removeProfilePhoto() {
  if (busy) return;
  if (dirty && !confirm("Discard unsaved profile changes?")) return;
  busy = true;
  try {
    await api("profile/photo", { method: "DELETE" });
    data = await api("state");
    dirty = false;
    render();
    toast("Profile picture removed.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
  }
}
function profilePage() {
  const u = data.user,
    initials = u.name
      .trim()
      .split(/\s+/)
      .map((x) => x[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
    grades = [
      "Kindergarten",
      ...Array.from({ length: 12 }, (_, i) => "Grade " + (i + 1)),
    ];
  return `<div class="profile-layout"><section class="profile-banner"><div class="profile-photo-controls"><div class="profile-avatar">${avatarContent(u)}</div><label class="photo-upload">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadProfilePhoto(event)" aria-label="Choose profile picture"></label>${u.avatar_key ? '<button class="link-btn" onclick="removeProfilePhoto()">Remove photo</button>' : ""}</div><div class="profile-identity"><h2>${esc(u.name)}</h2><p>${esc(u.email)}</p><span class="profile-role">${ico(u.role === "head" ? "verified_user" : "school")}${u.role === "head" ? "Head Teacher" : "Teacher"}</span></div>${u.avatarError ? `<p class="photo-error" role="alert">${esc(u.avatarError)} <button type="button" class="link-btn" onclick="load()">Retry</button></p>` : ""}</section><form class="panel profile-form" onsubmit="saveProfile(event)"><div class="profile-section-title">${ico("person")}<div><h2>Personal details</h2><p>Your name appears on submissions and reviews.</p></div></div><div class="form-grid">${field("name", "Full name", `<input id="name" name="name" value="${esc(u.name)}" required maxlength="120" autocomplete="name">`)}${field("email", "Email", `<input id="email" value="${esc(u.email)}" readonly>`)}</div><div class="profile-section-title teaching-title">${ico("auto_stories")}<div><h2>Teaching details</h2><p>Keep your teaching assignment up to date.</p></div></div><div class="field"><label for="assignment">Department</label><input id="assignment" name="assignment" value="${esc(u.assignment)}" maxlength="120" placeholder="e.g. Mathematics Department"></div><fieldset class="profile-choices"><legend>Subjects handled</legend><div class="choice-grid">${subjects.map((subject) => `<label class="choice-chip"><input type="checkbox" name="subjects" value="${esc(subject)}" ${(u.subjects || []).includes(subject) ? "checked" : ""}><span>${esc(subject)}</span></label>`).join("")}</div></fieldset><fieldset class="profile-choices"><legend>Grade levels</legend><div class="choice-grid grades">${grades.map((grade) => `<label class="choice-chip"><input type="checkbox" name="grade_levels" value="${grade}" ${(u.grade_levels || []).includes(grade) ? "checked" : ""}><span>${grade}</span></label>`).join("")}</div></fieldset><p class="form-error" role="alert"></p><div class="form-actions"><button class="primary" type="submit">Save profile</button></div></form></div>`;
}
async function saveProfile(e) {
  await formSave(e, async (form) => {
    const f = new FormData(form);
    await api("profile", {
      method: "PATCH",
      body: JSON.stringify({
        name: f.get("name").trim(),
        assignment: f.get("assignment").trim(),
        subjects: f.getAll("subjects"),
        grade_levels: f.getAll("grade_levels"),
      }),
    });
    toast("Profile saved.");
  });
}
