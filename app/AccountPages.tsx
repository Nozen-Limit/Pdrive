import { useBusy } from "./operations";
import { useState } from "react";
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  EditOutlined,
  NotificationsNoneOutlined,
  PushPinOutlined,
  UploadOutlined,
} from "@mui/icons-material";
import { api, backend, message } from "./api";
import { areas, date, grades } from "./domain";
import type { Person, SchoolNote, SchoolState } from "./types";
import { Empty, ErrorNotice, formGrid, row, type Confirm } from "./ui";
type Common = {
  state: SchoolState;
  onChanged: () => Promise<void>;
  notify: (text: string) => void;
  confirm: Confirm;
  setDirty: (value: boolean) => void;
};
export function Notes({ state, onChanged, notify, confirm, setDirty }: Common) {
  const [editing, setEditing] = useState<SchoolNote | null | undefined>(
      undefined,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useBusy(),
    [changed, setChanged] = useState(false);
  async function close() {
    if (
      changed &&
      !(await confirm(
        "Discard note changes?",
        "Your unsaved changes will be lost.",
        "Discard changes",
      ))
    )
      return;
    setEditing(undefined);
    setChanged(false);
    setDirty(false);
    setError("");
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await api(
        editing ? "notes/" + editing.id : "notes",
        {
          title: String(fields.title).trim(),
          body: String(fields.body).trim(),
          pinned: fields.pinned === "on",
        },
        editing ? "PATCH" : "POST",
      );
      setEditing(undefined);
      setChanged(false);
      setDirty(false);
      await onChanged();
      notify("Note saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(note: SchoolNote, remove = false) {
    if (busy) return;
    if (
      remove &&
      !(await confirm(
        "Delete note?",
        "This permanently deletes this personal note.",
        "Delete note",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(
        "notes/" + note.id,
        remove
          ? undefined
          : { title: note.title, body: note.body, pinned: !note.pinned },
        remove ? "DELETE" : "PATCH",
      );
      await onChanged();
      notify(
        remove
          ? "Note deleted."
          : note.pinned
            ? "Note unpinned."
            : "Note pinned.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<Add />}
          variant="contained"
          onClick={() => {
            setEditing(null);
            setError("");
          }}
        >
          New note
        </Button>
      </Box>
      {editing === undefined && <ErrorNotice error={error} />}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,260px),1fr))",
          maxWidth: 1120,
          alignItems: "start",
          gap: 1.5,
        }}
      >
        {state.notes.map((note) => (
          <Card key={note.id} sx={{ maxWidth: 340, width: "100%" }}>
            <CardContent sx={{ p: 2 }}>
              <Box
                sx={{
                  ...row,
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Typography
                  variant="h3"
                  component="h2"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {note.title}
                </Typography>
                {note.pinned && (
                  <PushPinOutlined fontSize="small" color="action" />
                )}
              </Box>
              <Typography
                sx={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  mt: 1.5,
                  lineHeight: 1.8,
                }}
              >
                {note.body}
              </Typography>
            </CardContent>
            <CardActions sx={{ px: 1.5, pb: 1.5, flexWrap: "wrap" }}>
              <Button disabled={busy} onClick={() => void action(note)}>
                {note.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing(note);
                  setError("");
                }}
              >
                Edit
              </Button>
              <Button disabled={busy} onClick={() => void action(note, true)}>
                Delete
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>
      {!state.notes.length && (
        <Empty title="No notes yet">
          Create a personal note. Pinned notes appear on your Overview.
        </Empty>
      )}
      <Dialog
        open={editing !== undefined}
        onClose={() => {
          if (!busy) void close();
        }}
        aria-labelledby="note-title"
      >
        <DialogTitle id="note-title">
          {editing ? "Edit note" : "New note"}
        </DialogTitle>
        <Box
          component="form"
          onSubmit={save}
          onChange={() => {
            setChanged(true);
            setDirty(true);
          }}
        >
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                name="title"
                label="Title"
                defaultValue={editing?.title || ""}
                required
                autoFocus
                disabled={busy}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                name="body"
                label="Note"
                defaultValue={editing?.body || ""}
                required
                multiline
                minRows={5}
                disabled={busy}
                slotProps={{ htmlInput: { maxLength: 5000 } }}
              />
              <FormControlLabel
                label="Pin this note"
                control={
                  <Checkbox
                    name="pinned"
                    defaultChecked={editing?.pinned || false}
                    disabled={busy}
                  />
                }
              />
              <ErrorNotice error={error} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => void close()}>
              Cancel
            </Button>
            <Button variant="contained" type="submit" disabled={busy}>
              Save note
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
export function Notifications({
  state,
  onChanged,
  onOpen,
  onCollaboration,
}: {
  state: SchoolState;
  onChanged: () => Promise<void>;
  onOpen: (id: string) => void;
  onCollaboration: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useBusy();
  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("notifications", {}, "POST");
      await onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ maxWidth: 960 }}>
      <Box sx={{ ...row, justifyContent: "space-between", mb: 2 }}>
        <Typography color="text.secondary">
          {state.notifications.filter((n) => !n.read).length} unread
        </Typography>
        <Button
          variant="outlined"
          disabled={busy || !state.notifications.some((n) => !n.read)}
          onClick={() => void acknowledge()}
        >
          Mark all as read
        </Button>
      </Box>
      <ErrorNotice error={error} />
      {state.notifications.map((notice) => (
        <Box
          component="article"
          key={notice.id}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <NotificationsNoneOutlined
            fontSize="small"
            color={notice.read ? "disabled" : "primary"}
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              sx={{
                overflowWrap: "anywhere",
                fontWeight: notice.read ? 400 : 500,
              }}
            >
              {notice.body}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {date(notice.created)}
              {notice.read ? "" : " · Unread"}
            </Typography>
            {notice.module && (
              <Button
                onClick={() =>
                  /collaborat/i.test(notice.body)
                    ? onCollaboration()
                    : onOpen(notice.module!)
                }
                sx={{ display: "block", p: 0, mt: 0.5, minHeight: 0 }}
              >
                Open resource
              </Button>
            )}
          </Box>
        </Box>
      ))}
      {!state.notifications.length && <Empty title="No notifications" />}
    </Box>
  );
}
const approvalLabel = (value?: string) =>
  value === "approved"
    ? "Approved"
    : value === "rejected"
      ? "Rejected"
      : "Pending approval";
export function Teachers({
  state,
  onChanged,
  notify,
}: Pick<Common, "state" | "onChanged" | "notify">) {
  const [filter, setFilter] = useState("all"),
    [person, setPerson] = useState<Person | null>(null),
    [review, setReview] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useBusy();
  const teachers = state.teachers.filter(
    (p) =>
      p.role === "teacher" &&
      (filter === "all" || p.approval_status === filter),
  );
  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person || busy) return;
    const note = String(
        new FormData(event.currentTarget).get("note") || "",
      ).trim(),
      decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
        "value",
      );
    setBusy(true);
    setError("");
    try {
      await api("accounts/" + person.id, { decision, note });
      setPerson(null);
      setReview(false);
      await onChanged();
      notify(
        decision === "approved"
          ? "Teacher account approved."
          : "Account request rejected.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Box sx={{ ...row, mb: 2, justifyContent: "space-between" }}>
        <TextField
          select
          label="Account status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ width: 220 }}
        >
          {["all", "approved", "pending", "rejected"].map((value) => (
            <MenuItem key={value} value={value}>
              {value === "all" ? "All teachers" : approvalLabel(value)}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => void onChanged()}>Refresh</Button>
      </Box>
      {teachers.map((teacher) => (
        <Box
          component="article"
          key={teacher.id}
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 2,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Avatar
            src={teacher.avatarUrl}
            alt={`${teacher.name} profile picture`}
            sx={{ width: 36, height: 36, fontSize: 14 }}
          >
            {teacher.name[0]}
          </Avatar>
          <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500 }}>{teacher.name}</Typography>
            <Typography
              color="text.secondary"
              sx={{ overflowWrap: "anywhere" }}
            >
              {teacher.email}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Requested {date(teacher.requested_at)}
            </Typography>
            {teacher.approval_note && (
              <Typography sx={{ mt: 0.5 }}>{teacher.approval_note}</Typography>
            )}
          </Box>
          <Box sx={row}>
            <Chip label={approvalLabel(teacher.approval_status)} />
            <Button
              onClick={() => {
                setPerson(teacher);
                setReview(false);
                setError("");
              }}
            >
              View profile
            </Button>
            {teacher.approval_status === "pending" &&
              (teacher.emailConfirmed ? (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setPerson(teacher);
                    setReview(true);
                    setError("");
                  }}
                >
                  Review account
                </Button>
              ) : (
                <Typography color="text.secondary" variant="caption">
                  Email not confirmed
                </Typography>
              ))}
          </Box>
        </Box>
      ))}
      {!teachers.length && <Empty title="No accounts match" />}
      <Dialog
        open={!!person}
        onClose={() => {
          if (!busy) setPerson(null);
        }}
        aria-labelledby="teacher-dialog-title"
      >
        <DialogTitle id="teacher-dialog-title">
          {review ? "Review teacher account" : "Teacher profile"}
        </DialogTitle>
        {person && (
          <Box component="form" onSubmit={decide}>
            <DialogContent>
              <Typography variant="h2" component="h3" gutterBottom>
                {person.name}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ overflowWrap: "anywhere", mb: 2 }}
              >
                {person.email}
              </Typography>
              {review ? (
                <>
                  <Typography sx={{ mb: 2 }}>
                    Approval grants Teacher access. Head Teacher accounts are
                    provisioned separately.
                  </Typography>
                  <TextField
                    name="note"
                    label="Decision note (optional)"
                    multiline
                    minRows={3}
                    fullWidth
                    disabled={busy}
                    slotProps={{ htmlInput: { maxLength: 2000 } }}
                  />
                </>
              ) : (
                <Stack spacing={1.5}>
                  {[
                    ["Department", person.assignment || "Not provided"],
                    [
                      "Subjects handled",
                      person.subjects?.join(", ") || "Not provided",
                    ],
                    [
                      "Grade levels",
                      person.grade_levels?.join(", ") || "Not provided",
                    ],
                    ["Account status", approvalLabel(person.approval_status)],
                    [
                      "Email confirmation",
                      person.emailConfirmed ? "Confirmed" : "Not confirmed",
                    ],
                  ].map(([label, value]) => (
                    <Box key={label}>
                      <Typography variant="caption" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
              <ErrorNotice error={error} />
            </DialogContent>
            <DialogActions sx={{ flexWrap: "wrap" }}>
              <Button disabled={busy} onClick={() => setPerson(null)}>
                Close
              </Button>
              {review ? (
                <>
                  <Button type="submit" value="rejected" disabled={busy}>
                    Reject request
                  </Button>
                  <Button
                    variant="contained"
                    type="submit"
                    value="approved"
                    disabled={busy}
                  >
                    Approve Teacher
                  </Button>
                </>
              ) : person.approval_status === "pending" &&
                person.emailConfirmed ? (
                <Button onClick={() => setReview(true)}>Review account</Button>
              ) : null}
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
export function Profile({
  state,
  onChanged,
  onPerson,
  notify,
  confirm,
  setDirty,
}: Common & { onPerson: (value: Partial<Person>) => void }) {
  const user = state.user,
    [selectedAreas, setSelectedAreas] = useState<string[]>(user.subjects || []),
    [selectedGrades, setSelectedGrades] = useState<string[]>(
      user.grade_levels || [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useBusy(),
    [phoneError, setPhoneError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    try {
      const phone = backend.phone.normalize(String(fields.phone || ""));
      setBusy(true);
      await api(
        "profile",
        {
          name: String(fields.name).trim(),
          phone,
          assignment: String(fields.assignment || ""),
          location: String(fields.location || ""),
          subjects: selectedAreas,
          grade_levels: selectedGrades,
        },
        "PATCH",
      );
      setDirty(false);
      await onChanged();
      notify("Profile saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function photo(file: File) {
    if (busy) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2097152
    ) {
      setError("Choose a JPG, PNG or WebP image up to 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 512, 512);
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(
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
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88),
      );
      if (!blob) throw Error("The picture could not be processed.");
      const body = new FormData();
      body.set("file", new File([blob], "profile.jpg", { type: "image/jpeg" }));
      const saved = await api<Partial<Person>>("profile/photo", body);
      onPerson(saved);
      notify("Profile picture saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto() {
    if (
      busy ||
      !(await confirm(
        "Remove profile picture?",
        "Your profile will show your initials instead.",
        "Remove picture",
      ))
    )
      return;
    setBusy(true);
    try {
      await api("profile/photo", undefined, "DELETE");
      onPerson({ avatarUrl: undefined, avatar_key: undefined });
      notify("Profile picture removed.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ maxWidth: 880 }}>
      <Box sx={{ ...row, gap: 2, mb: 3, alignItems: "flex-start" }}>
        <Avatar
          src={user.avatarUrl}
          alt={`${user.name} profile picture`}
          sx={{ width: 64, height: 64, borderRadius: 1, fontSize: 24 }}
        >
          {user.name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" component="h2" gutterBottom>
            {user.name}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {user.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.role === "head" ? "Head Teacher" : "Teacher"}
          </Typography>
          <Box sx={{ ...row, mt: 1 }}>
            <Button
              component="label"
              startIcon={<UploadOutlined />}
              disabled={busy}
            >
              Choose profile picture
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void photo(file);
                  e.target.value = "";
                }}
              />
            </Button>
            {user.avatar_key && (
              <Button onClick={() => void removePhoto()} disabled={busy}>
                Remove picture
              </Button>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            JPG, PNG or WebP · up to 2 MB
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ mb: 3 }} />
      <Box component="form" onSubmit={save} onChange={() => setDirty(true)}>
        <Box
          component="fieldset"
          disabled={busy}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <Box sx={formGrid}>
            <TextField
              name="name"
              label="Full name"
              defaultValue={user.name}
              required
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField
              label="Email"
              value={user.email}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              name="phone"
              label="Phone number"
              type="tel"
              defaultValue={backend.phone.format(user.phone || "")}
              error={!!phoneError}
              helperText={
                phoneError ||
                "Philippine mobile or landline: 0912 345 6789 or (02) 8123 4567."
              }
              onBlur={(e) => {
                try {
                  backend.phone.normalize(e.target.value);
                  e.target.value = backend.phone.format(e.target.value);
                  setPhoneError("");
                } catch (error) {
                  setPhoneError(message(error));
                }
              }}
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            <TextField
              name="location"
              label="Location"
              defaultValue={user.location || ""}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              name="assignment"
              label="Department"
              defaultValue={user.assignment || ""}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <Box />
            <Autocomplete
              multiple
              freeSolo
              options={[...new Set([...areas, ...selectedAreas])]}
              value={selectedAreas}
              onChange={(_, value) => {
                setSelectedAreas(value);
                setDirty(true);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Subjects handled" />
              )}
            />
            <Autocomplete
              multiple
              freeSolo
              options={[...new Set([...grades, ...selectedGrades])]}
              value={selectedGrades}
              onChange={(_, value) => {
                setSelectedGrades(value);
                setDirty(true);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Grade levels" />
              )}
            />
          </Box>
        </Box>
        <Box sx={{ mt: 2 }}>
          <ErrorNotice error={error} />
        </Box>
        <Button
          variant="contained"
          type="submit"
          disabled={busy || !!phoneError}
          sx={{ mt: 1 }}
        >
          Save profile
        </Button>
      </Box>
    </Box>
  );
}
