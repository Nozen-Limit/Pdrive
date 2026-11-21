import { useBusy } from "./operations";
import { useState, type ReactNode } from "react";
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
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  CheckCircleOutlined,
  EditOutlined,
  GroupsOutlined,
  NotificationsNoneOutlined,
  PersonOutlined,
  PushPinOutlined,
  RateReviewOutlined,
  UploadFileOutlined,
  UploadOutlined,
  LockOutlined,
  PhotoCameraOutlined,
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
      {!state.notes.length && <Empty title="No notes yet" />}
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
// What kind of event a notice is, read from its wording (the database stores
// only the sentence). Each kind gets its own icon and a plain label.
const noticeKinds: [RegExp, string, ReactNode][] = [
  [/approved/i, "Approved", <CheckCircleOutlined fontSize="small" />],
  [
    /returned|feedback|revis/i,
    "Feedback",
    <RateReviewOutlined fontSize="small" />,
  ],
  [
    /collaborat|invitation/i,
    "Collaboration",
    <GroupsOutlined fontSize="small" />,
  ],
  [
    /submitted|review|resubmitted/i,
    "Submission",
    <UploadFileOutlined fontSize="small" />,
  ],
  [/account|sign|registered/i, "Account", <PersonOutlined fontSize="small" />],
];
const noticeKind = (body: string) =>
  noticeKinds.find(([pattern]) => pattern.test(body)) || [
    null,
    "Notice",
    <NotificationsNoneOutlined fontSize="small" />,
  ];
const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
/** "Today", "Yesterday", "This week" or "Earlier", for grouping. */
function noticeDay(created: string, now: Date) {
  const days = Math.round(
    (startOfDay(now) - startOfDay(new Date(created))) / 86400000,
  );
  return days <= 0
    ? "Today"
    : days === 1
      ? "Yesterday"
      : days < 7
        ? "This week"
        : "Earlier";
}
/** "5 min ago", "3 hr ago", then the date. */
function noticeTime(created: string, now: Date) {
  const minutes = Math.floor(
    (now.getTime() - new Date(created).getTime()) / 60000,
  );
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hr ago`;
  return date(created);
}
export function Notifications({
  state,
  onChanged,
  onOpen,
  onCollaboration,
  now = new Date(),
}: {
  state: SchoolState;
  onChanged: () => Promise<void>;
  onOpen: (id: string) => void;
  onCollaboration: () => void;
  /** Fixed in previews so the grouping is stable. */
  now?: Date;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useBusy(),
    [show, setShow] = useState<"unread" | "all">(() =>
      state.notifications.some((n) => !n.read) ? "unread" : "all",
    ),
    [kind, setKind] = useState<string | null>(null);
  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("notifications", {}, "POST");
      await onChanged();
      setShow("all");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const unread = state.notifications.filter((n) => !n.read).length;
  const kinds = Array.from(
    new Set(state.notifications.map((n) => noticeKind(n.body)[1] as string)),
  );
  const visible = state.notifications.filter(
    (n) =>
      (show === "all" || !n.read) && (!kind || noticeKind(n.body)[1] === kind),
  );
  const groups = ["Today", "Yesterday", "This week", "Earlier"]
    .map((day) => ({
      day,
      items: visible.filter((n) => noticeDay(n.created, now) === day),
    }))
    .filter((group) => group.items.length);
  const tone: Record<string, string> = {
    Approved: "success.main",
    Feedback: "warning.main",
    Collaboration: "info.main",
    Submission: "primary.main",
  };
  return (
    <Box sx={{ width: "100%" }}>
      <ErrorNotice error={error} />
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 2 }}>
        <Box
          role="group"
          aria-label="Which notifications to show"
          sx={{ display: "flex", bgcolor: "action.hover", p: 0.375 }}
        >
          {(
            [
              ["unread", `Unread`, unread],
              ["all", "All", state.notifications.length],
            ] as const
          ).map(([value, label, n]) => (
            <Button
              key={value}
              aria-pressed={show === value}
              onClick={() => setShow(value)}
              sx={{
                px: 1.75,
                color: show === value ? "text.primary" : "text.secondary",
                bgcolor: show === value ? "background.paper" : "transparent",
                boxShadow: show === value ? 1 : 0,
                "&:hover": {
                  bgcolor: show === value ? "background.paper" : "action.hover",
                },
              }}
            >
              {label}
              <Box
                component="span"
                sx={{ ml: 0.75, color: "text.secondary", fontSize: 11 }}
              >
                {n}
              </Box>
            </Button>
          ))}
        </Box>
        <Button
          variant="outlined"
          disabled={busy || !unread}
          onClick={() => void acknowledge()}
        >
          Mark all as read
        </Button>
      </Box>
      {kinds.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
          {[null, ...kinds].map((k) => (
            <Button
              key={k || "every"}
              size="small"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              variant={kind === k ? "contained" : "outlined"}
              sx={{ minHeight: 28, py: 0.25 }}
            >
              {k || "Every type"}
            </Button>
          ))}
        </Box>
      )}
      <Paper variant="outlined">
        {groups.map((group, gi) => (
          <Box key={group.day} component="section">
            <Typography
              component="h2"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "text.secondary",
                px: 2.5,
                pt: gi ? 2.5 : 2,
                pb: 1,
              }}
            >
              {group.day}
            </Typography>
            {group.items.map((notice) => {
              const [, kindLabel, icon] = noticeKind(notice.body);
              const collaboration = /collaborat/i.test(notice.body);
              // "Resource submitted: Title — Name" reads as a headline plus the resource.
              const split = notice.body.match(/^([^:]{3,60}):\s*(.+)$/);
              const headline = split ? split[1] : notice.body;
              const subject = split ? split[2] : "";
              const color = tone[kindLabel as string] || "text.secondary";
              const go = notice.module
                ? () =>
                    collaboration ? onCollaboration() : onOpen(notice.module!)
                : undefined;
              return (
                <Box
                  component="article"
                  key={notice.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "36px minmax(0,1fr) auto",
                      md: "36px minmax(0,1fr) 220px",
                    },
                    alignItems: "center",
                    gap: 1.75,
                    px: 2.5,
                    py: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                    cursor: go ? "pointer" : "default",
                    bgcolor: notice.read ? "transparent" : "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                    "&:hover .notice-go": { opacity: 1 },
                  }}
                  onClick={go}
                >
                  <Box
                    aria-hidden
                    sx={(theme) => ({
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      color,
                      bgcolor: `color-mix(in srgb, ${
                        color === "text.secondary"
                          ? theme.palette.text.secondary
                          : (theme.palette as any)[color.split(".")[0]].main
                      } 14%, transparent)`,
                    })}
                  >
                    {icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: "text.secondary",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                      }}
                    >
                      {!notice.read && (
                        <Box
                          component="span"
                          aria-label="Unread"
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            bgcolor: "error.main",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {headline}
                    </Typography>
                    {subject && (
                      <Typography
                        sx={{
                          fontWeight: notice.read ? 500 : 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={subject}
                      >
                        {subject}
                      </Typography>
                    )}
                  </Box>
                  <Box
                    sx={{
                      ...row,
                      gap: 1.5,
                      flexWrap: "nowrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {go && (
                      <Button
                        className="notice-go"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          go();
                        }}
                        sx={{
                          display: { xs: "none", md: "inline-flex" },
                          opacity: 0,
                          transition: "opacity .15s",
                          bgcolor: "background.paper",
                          "&:focus-visible": { opacity: 1 },
                        }}
                      >
                        {collaboration ? "Open" : "Open resource"}
                      </Button>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        whiteSpace: "nowrap",
                        minWidth: 76,
                        textAlign: "right",
                      }}
                    >
                      {noticeTime(notice.created, now)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
        {!groups.length && (
          <Typography color="text.secondary" sx={{ px: 2, py: 3 }}>
            {show === "unread" && state.notifications.length
              ? "You have read everything. Choose All to see earlier notifications."
              : "No notifications yet. Reviews, feedback and invitations will appear here."}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
const approvalLabel = (value?: string) =>
  value === "approved"
    ? "Approved"
    : value === "rejected"
      ? "Rejected"
      : value === "deactivated"
        ? "Deactivated"
        : "Pending approval";
export function Teachers({
  state,
  onChanged,
  notify,
  confirm,
}: Pick<Common, "state" | "onChanged" | "notify"> & {
  confirm: (title: string, body: string, action?: string) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState("all"),
    [person, setPerson] = useState<Person | null>(null),
    [review, setReview] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useBusy();
  const me = state.user;
  const isOwner = !!(me.isOwner || me.is_owner);
  const teachers = state.teachers.filter(
    (p) =>
      p.id !== me.id &&
      (p.role === "teacher" || isOwner) &&
      (filter === "all" ||
        (filter === "head"
          ? p.role === "head"
          : filter === "coordinator"
            ? !!p.is_coordinator
            : p.approval_status === filter)),
  );
  async function manage(
    teacher: Person,
    task: () => Promise<void>,
    title: string,
    body: string,
    action: string,
    done: string,
  ) {
    if (busy || !(await confirm(title, body, action))) return;
    setBusy(true);
    setError("");
    try {
      await task();
      await onChanged();
      notify(done);
    } catch (e) {
      notify(message(e));
    } finally {
      setBusy(false);
    }
  }
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
          {[
            "all",
            "approved",
            "pending",
            "rejected",
            "deactivated",
            "coordinator",
            ...(isOwner ? ["head"] : []),
          ].map((value) => (
            <MenuItem key={value} value={value}>
              {value === "all"
                ? "All accounts"
                : value === "coordinator"
                  ? "Subject coordinators"
                  : value === "head"
                    ? "Head teachers"
                    : approvalLabel(value)}
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
            {teacher.role === "head" && (
              <Chip label="Head teacher" color="primary" />
            )}
            {teacher.is_coordinator && <Chip label="Coordinator" />}
            {teacher.approval_status === "approved" &&
              teacher.role === "teacher" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void manage(
                      teacher,
                      () =>
                        backend.bank.setRole(
                          teacher.id,
                          "teacher",
                          !teacher.is_coordinator,
                        ),
                      teacher.is_coordinator
                        ? "Remove coordinator role?"
                        : "Make " + teacher.name + " a subject coordinator?",
                      teacher.is_coordinator
                        ? "They will no longer review resources assigned to them."
                        : "Head teachers can then assign resources to them for review.",
                      teacher.is_coordinator
                        ? "Remove role"
                        : "Make coordinator",
                      teacher.is_coordinator
                        ? "Coordinator role removed."
                        : teacher.name + " is now a subject coordinator.",
                    )
                  }
                >
                  {teacher.is_coordinator
                    ? "Remove coordinator"
                    : "Make coordinator"}
                </Button>
              )}
            {isOwner && teacher.approval_status === "approved" && (
              <Button
                disabled={busy}
                onClick={() =>
                  void manage(
                    teacher,
                    () =>
                      backend.bank.setRole(
                        teacher.id,
                        teacher.role === "head" ? "teacher" : "head",
                        false,
                      ),
                    teacher.role === "head"
                      ? "Change " + teacher.name + " to a teacher?"
                      : "Make " + teacher.name + " a head teacher?",
                    teacher.role === "head"
                      ? "They will lose review, approval and report access."
                      : "They will review resources, approve accounts and see school reports.",
                    teacher.role === "head"
                      ? "Make teacher"
                      : "Make head teacher",
                    "Role updated.",
                  )
                }
              >
                {teacher.role === "head" ? "Make teacher" : "Make head teacher"}
              </Button>
            )}
            {teacher.role === "teacher" &&
              ["approved", "deactivated"].includes(
                teacher.approval_status || "",
              ) && (
                <Button
                  color={
                    teacher.approval_status === "approved" ? "error" : "primary"
                  }
                  disabled={busy}
                  onClick={() => {
                    const active = teacher.approval_status !== "approved";
                    void manage(
                      teacher,
                      () => backend.bank.setActive(teacher.id, active),
                      active
                        ? "Reactivate " + teacher.name + "?"
                        : "Deactivate " + teacher.name + "?",
                      active
                        ? "They can sign in and use SIKAP again."
                        : "They can no longer sign in to SIKAP. Their approved resources stay in the Digital Bank with their name.",
                      active ? "Reactivate" : "Deactivate",
                      active ? "Account reactivated." : "Account deactivated.",
                    );
                  }}
                >
                  {teacher.approval_status === "approved"
                    ? "Deactivate"
                    : "Reactivate"}
                </Button>
              )}
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
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0,1fr)", md: "300px minmax(0,1fr)" },
        gap: 2.5,
        alignItems: "start",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          display: "grid",
          justifyItems: "center",
          textAlign: "center",
          gap: 1,
          position: { md: "sticky" },
          top: { md: 76 },
        }}
      >
        <Box sx={{ position: "relative", mb: 1 }}>
          <Avatar
            src={user.avatarUrl}
            alt={`${user.name} profile picture`}
            sx={{
              width: 104,
              height: 104,
              fontSize: 36,
              fontWeight: 600,
              bgcolor: "primary.main",
              color: "background.paper",
            }}
          >
            {user.name
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </Avatar>
          <IconButton
            component="label"
            aria-label="Choose profile picture"
            title="Choose profile picture (JPG, PNG or WebP, up to 2 MB)"
            disabled={busy}
            sx={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 34,
              height: 34,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <PhotoCameraOutlined sx={{ fontSize: 17 }} />
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
          </IconButton>
        </Box>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
          {user.name}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ overflowWrap: "anywhere", fontSize: 13 }}
        >
          {user.email}
        </Typography>
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            px: 1,
            py: 0.25,
            bgcolor: "action.selected",
            letterSpacing: "0.04em",
          }}
        >
          {user.role === "head" ? "HEAD TEACHER" : "TEACHER"}
        </Box>
        {(selectedAreas.length > 0 || selectedGrades.length > 0) && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.75,
              justifyContent: "center",
              mt: 1.5,
              pt: 2,
              borderTop: 1,
              borderColor: "divider",
              width: "100%",
            }}
          >
            {[...selectedAreas, ...selectedGrades].map((x) => (
              <Box
                key={x}
                component="span"
                sx={{
                  fontSize: 12,
                  px: 1,
                  py: 0.25,
                  border: 1,
                  borderColor: "divider",
                }}
              >
                {x}
              </Box>
            ))}
          </Box>
        )}
        {user.avatar_key && (
          <Button
            onClick={() => void removePhoto()}
            disabled={busy}
            sx={{ mt: 1, color: "text.secondary" }}
          >
            Remove picture
          </Button>
        )}
      </Paper>
      <Paper
        variant="outlined"
        component="form"
        onSubmit={save}
        onChange={() => setDirty(true)}
        sx={{ minWidth: 0 }}
      >
        <Box
          component="fieldset"
          disabled={busy}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <Typography
            variant="h3"
            component="h3"
            sx={{ px: 3, py: 1.75, borderBottom: 1, borderColor: "divider" }}
          >
            Personal information
          </Typography>
          <Box sx={{ ...formGrid, p: 3 }}>
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
              helperText="Used to sign in"
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <LockOutlined
                      sx={{ fontSize: 16, color: "text.secondary" }}
                    />
                  ),
                },
              }}
            />
            <TextField
              name="phone"
              label="Phone number"
              type="tel"
              defaultValue={backend.phone.format(user.phone || "")}
              error={!!phoneError}
              helperText={phoneError || undefined}
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
          </Box>
          <Typography
            variant="h3"
            component="h3"
            sx={{
              px: 3,
              py: 1.75,
              borderTop: 1,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            Teaching
          </Typography>
          <Box sx={{ ...formGrid, p: 3 }}>
            <TextField
              name="assignment"
              label="Department"
              defaultValue={user.assignment || ""}
              slotProps={{ htmlInput: { maxLength: 120 } }}
              sx={{ gridColumn: "1 / -1" }}
            />
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
        <Box sx={{ px: 3 }}>
          <ErrorNotice error={error} />
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            px: 3,
            py: 1.75,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Button
            variant="contained"
            type="submit"
            disabled={busy || !!phoneError}
          >
            Save changes
          </Button>
        </Box>
      </Paper>
      <PasswordCard notify={notify} />
    </Box>
  );
}

/** Change the password while signed in; the current one is checked first. */
function PasswordCard({ notify }: { notify: (text: string) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      f = new FormData(form),
      next = String(f.get("next") || "");
    setError("");
    if (next !== String(f.get("confirm") || "")) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await backend.changePassword(String(f.get("current") || ""), next);
      form.reset();
      notify("Password changed.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Paper
      variant="outlined"
      component="form"
      onSubmit={change}
      sx={{ gridColumn: { md: 2 }, minWidth: 0 }}
    >
      <Typography
        variant="h3"
        component="h3"
        sx={{ px: 3, py: 1.75, borderBottom: 1, borderColor: "divider" }}
      >
        Password
      </Typography>
      <Box sx={{ ...formGrid, p: 3 }}>
        <TextField
          name="current"
          label="Current password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          sx={{ gridColumn: "1 / -1" }}
        />
        <TextField
          name="next"
          label="New password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          helperText="At least 12 characters"
          slotProps={{ htmlInput: { minLength: 12 } }}
        />
        <TextField
          name="confirm"
          label="Confirm new password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
        />
      </Box>
      <Box sx={{ px: 3 }}>
        <ErrorNotice error={error} />
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 1.75,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
          }
          label="Show passwords"
        />
        <Button variant="contained" type="submit" disabled={busy}>
          {busy ? "Changing…" : "Change password"}
        </Button>
      </Box>
    </Paper>
  );
}
