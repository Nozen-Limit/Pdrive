import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  GroupsOutlined,
  LockOutlined,
  Refresh,
  Search,
  UploadFileOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import type { CollaborationState, Person, Resource } from "./types";
import { date, fileAccept, fileHint } from "./domain";
import {
  ErrorNotice,
  FileTile,
  Loading,
  initials,
  row,
  type Confirm,
} from "./ui";
import { useBusy } from "./operations";

export default function Collaboration({
  person,
  onOpen,
  onUpload,
  notify,
  confirm,
  setDirty,
  onChanged,
}: {
  person: Person;
  onOpen: (id: string) => void;
  onUpload: () => void;
  notify: (text: string) => void;
  confirm: Confirm;
  setDirty: (value: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const [listing, setListing] = useState<CollaborationState | null>(null),
    [detail, setDetail] = useState<CollaborationState | null>(null),
    [id, setId] = useState<string | null>(null),
    [scope, setScope] = useState("drafts"),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [epoch, setEpoch] = useState(0),
    [busy, setBusy] = useBusy(),
    [teacher, setTeacher] = useState(""),
    [comment, setComment] = useState(""),
    [changes, setChanges] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [progress, setProgress] = useState<number | null>(null);
  const staged = useRef<{
    file: File;
    upload_module: string;
    object_key: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      backend.bank.collaboration(),
      id ? backend.bank.collaboration(id) : Promise.resolve(null),
    ])
      .then(([list, resource]) => {
        if (!cancelled) {
          setListing(list);
          setDetail(resource);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, epoch]);
  useEffect(() => {
    setDirty(!!(comment || changes || file));
  }, [comment, changes, file, setDirty]);
  async function open(next: string | null) {
    if (busy) return;
    if (
      (comment || changes || file) &&
      !(await confirm(
        "Discard changes?",
        "Your unsaved comment or proposed file will be discarded.",
        "Discard changes",
      ))
    )
      return;
    setComment("");
    setChanges("");
    setFile(null);
    staged.current = null;
    setDirty(false);
    setId(next);
  }
  async function run(
    action: string,
    payload: Record<string, unknown> = {},
    target = id,
  ) {
    if (!target || busy) return;
    if (
      action === "submit" &&
      !(await confirm(
        "Submit selected version?",
        "The selected file, resource details and contributor credits will be fixed during head-teacher review.",
        "Submit for review",
      ))
    )
      return;
    if (
      action === "remove" &&
      !(await confirm(
        "Remove contributor?",
        "This teacher will lose access to the shared draft. Credits on submitted versions stay unchanged.",
        "Remove contributor",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (action === "propose") {
        if (!file || !changes.trim())
          throw Error(
            "Choose a PDF or DOCX file and describe the proposed changes.",
          );
        await backend.validateBankFile(file);
        if (!staged.current || staged.current.file !== file) {
          const upload_module = crypto.randomUUID();
          const object_key = await backend.bank.upload(
            upload_module,
            file,
            setProgress,
          );
          staged.current = { file, upload_module, object_key };
        }
        payload = {
          upload_module: staged.current.upload_module,
          object_key: staged.current.object_key,
          changes: changes.trim(),
        };
      }
      await backend.bank.collaborationAction({
        mid: target,
        action,
        payload,
        expected_revision: detail?.resource?.revision,
      });
      if (action === "comment") setComment("");
      if (action === "propose") {
        setChanges("");
        setFile(null);
        staged.current = null;
        setProgress(null);
      }
      if (action === "invite") setTeacher("");
      setEpoch((n) => n + 1);
      await onChanged();
      notify(
        action === "submit"
          ? "Selected version submitted for review."
          : action === "respond"
            ? "Invitation updated."
            : "Changes saved.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const r = detail?.resource,
    owner = r?.owner === person.id,
    locked = !!r && ((!r.bank_draft && r.status === "pending") || r.archived),
    members = detail?.members || [],
    proposals = detail?.proposals || [];
  const all = listing?.resources || [];
  const invites = all.filter((r) => r.membership === "invited");
  const joined = all.filter((r) => r.membership !== "invited");
  const mineCount = joined.filter((r) => r.owner === person.id).length;
  const resources = joined.filter(
    (r) =>
      (scope === "mine"
        ? r.owner === person.id
        : scope === "shared"
          ? r.owner !== person.id
          : true) &&
      `${r.title} ${r.creator} ${r.subject}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const stage = (x: Resource) =>
    x.bank_draft ? 0 : x.status === "approved" ? 3 : 2;
  const pill = (x: Resource) =>
    x.bank_draft
      ? (["Shared draft", "info"] as const)
      : x.status === "approved"
        ? (["Approved", "success"] as const)
        : x.status === "returned"
          ? (["Returned", "warning"] as const)
          : (["In review", "warning"] as const);
  const avatar = (name: string, size = 24) => (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        display: "inline-grid",
        placeItems: "center",
        fontSize: size < 24 ? 8 : 9,
        fontWeight: 700,
        color: "background.paper",
        bgcolor: "primary.main",
      }}
    >
      {initials(name || "?")}
    </Box>
  );
  return (
    <Box sx={{ width: "100%" }}>
      {id && (
        <Box sx={{ ...row, justifyContent: "space-between", mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => void open(null)}
            disabled={busy}
          >
            Back to collaboration
          </Button>
        </Box>
      )}
      <ErrorNotice error={error} retry={() => setEpoch((n) => n + 1)} />
      {loading ? (
        <Loading label="Loading collaboration…" />
      ) : error && !listing ? null : !id ? (
        <>
          {invites.map((inv) => (
            <Box
              key={inv.id}
              sx={(theme) => ({
                ...row,
                gap: 1.5,
                px: 2,
                py: 1.5,
                mb: 1.5,
                border: 1,
                borderColor: `color-mix(in srgb, ${theme.palette.info.main} 35%, transparent)`,
                bgcolor: `color-mix(in srgb, ${theme.palette.info.main} 9%, ${theme.palette.background.paper})`,
              })}
            >
              {avatar(inv.creator, 28)}
              <Typography sx={{ flex: 1, minWidth: 200 }}>
                <b>{inv.creator}</b> invited you to <b>{inv.title}</b>
              </Typography>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  void run("respond", { status: "declined" }, inv.id)
                }
                sx={{ bgcolor: "background.paper" }}
              >
                Decline
              </Button>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() =>
                  void run("respond", { status: "accepted" }, inv.id)
                }
              >
                Accept
              </Button>
            </Box>
          ))}
          <Box sx={{ ...row, gap: 1.25, mb: 2 }}>
            <Box
              role="group"
              aria-label="Show"
              sx={{ display: "inline-flex", bgcolor: "action.hover", p: 0.375 }}
            >
              {(
                [
                  ["all", "All", joined.length],
                  ["mine", "Mine", mineCount],
                  ["shared", "Shared with me", joined.length - mineCount],
                ] as const
              ).map(([value, label, n]) => {
                const on = (scope === "drafts" ? "all" : scope) === value;
                return (
                  <Button
                    key={value}
                    aria-pressed={on}
                    onClick={() => setScope(value)}
                    sx={{
                      px: 1.75,
                      color: on ? "text.primary" : "text.secondary",
                      bgcolor: on ? "background.paper" : "transparent",
                      boxShadow: on ? 1 : 0,
                      "&:hover": {
                        bgcolor: on ? "background.paper" : "action.hover",
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
                );
              })}
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              placeholder="Search"
              aria-label="Search shared work"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <Search
                      fontSize="small"
                      sx={{ mr: 1, color: "text.secondary" }}
                    />
                  ),
                },
              }}
              sx={{ width: { xs: "100%", sm: 260 } }}
            />
            <IconButton
              aria-label="Refresh"
              title="Refresh"
              onClick={() => setEpoch((n) => n + 1)}
              disabled={busy}
            >
              <Refresh fontSize="small" />
            </IconButton>
            <Button variant="contained" startIcon={<Add />} onClick={onUpload}>
              Start shared draft
            </Button>
          </Box>
          {!resources.length ? (
            <Box
              sx={{
                border: "1px dashed",
                borderColor: "divider",
                bgcolor: "background.paper",
                py: 5,
                px: 2,
                display: "grid",
                justifyItems: "center",
                gap: 1.25,
                textAlign: "center",
              }}
            >
              <GroupsOutlined sx={{ fontSize: 28, color: "text.secondary" }} />
              <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                {query
                  ? `Nothing matches “${query}”`
                  : scope === "shared"
                    ? "No one has shared a draft with you yet"
                    : "No shared drafts yet"}
              </Typography>
              <Button variant="contained" onClick={onUpload}>
                Start shared draft
              </Button>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0,1fr)",
                  md: "repeat(2,minmax(0,1fr))",
                },
                gap: 1.5,
              }}
            >
              {resources.map((x) => {
                const step = stage(x);
                const [label, tone] = pill(x);
                const isLocked =
                  (!x.bank_draft && x.status === "pending") || x.archived;
                return (
                  <Box
                    component="article"
                    key={x.id}
                    onClick={() => void open(x.id)}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      p: 2,
                      display: "grid",
                      gap: 1.75,
                      minWidth: 0,
                      cursor: "pointer",
                      "&:hover": { borderColor: "text.secondary" },
                    }}
                  >
                    <Box
                      sx={{ display: "flex", gap: 1.5, alignItems: "start" }}
                    >
                      <FileTile name={x.filename} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            void open(x.id);
                          }}
                          sx={{
                            p: 0,
                            minHeight: 0,
                            textAlign: "left",
                            justifyContent: "flex-start",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "text.primary",
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {x.title}
                        </Button>
                        <Typography
                          color="text.secondary"
                          sx={{ fontSize: 12 }}
                        >
                          {[x.subject, x.grade, x.term]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                      </Box>
                      <Box
                        component="span"
                        sx={(theme) => ({
                          fontSize: 11,
                          fontWeight: 600,
                          px: 1,
                          py: 0.25,
                          whiteSpace: "nowrap",
                          color: `${tone}.main`,
                          bgcolor: `color-mix(in srgb, ${theme.palette[tone].main} 13%, transparent)`,
                        })}
                      >
                        {label}
                      </Box>
                    </Box>
                    <Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4,1fr)",
                          gap: 0.5,
                        }}
                      >
                        {[0, 1, 2, 3].map((i) => (
                          <Box
                            key={i}
                            sx={{
                              height: 4,
                              bgcolor:
                                i < step || step === 3
                                  ? "primary.main"
                                  : i === step
                                    ? "warning.main"
                                    : "divider",
                            }}
                          />
                        ))}
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4,1fr)",
                          gap: 0.5,
                          mt: 0.5,
                          fontSize: 11,
                          color: "text.secondary",
                        }}
                      >
                        {["Drafting", "Proposals", "In review", "Approved"].map(
                          (s, i) => (
                            <Box
                              key={s}
                              component="span"
                              sx={
                                i === step
                                  ? { color: "text.primary", fontWeight: 600 }
                                  : undefined
                              }
                            >
                              {s}
                            </Box>
                          ),
                        )}
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        ...row,
                        gap: 1,
                        pt: 1.25,
                        borderTop: 1,
                        borderColor: "divider",
                        fontSize: 12,
                        color: "text.secondary",
                      }}
                    >
                      {avatar(x.creator, 22)}
                      <Typography sx={{ fontSize: 12 }}>
                        {x.owner === person.id ? "You" : x.creator}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      {isLocked && (
                        <Box
                          component="span"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <LockOutlined sx={{ fontSize: 13 }} />
                          Locked
                        </Box>
                      )}
                      <span>{date(x.updated)}</span>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </>
      ) : (
        r && (
          <>
            <Typography component="h2" variant="h2" sx={{ mb: 1 }}>
              {r.title}
            </Typography>
            <Box sx={{ ...row, mb: 2 }}>
              <Chip
                label={
                  r.bank_draft
                    ? "Shared draft"
                    : r.status === "pending"
                      ? "In review · locked"
                      : r.status
                }
              />
              <Typography color="text.secondary">
                {r.subject} · {r.grade} · {r.term}
              </Typography>
              {(owner || (!r.bank_draft && r.status === "approved")) && (
                <Button onClick={() => onOpen(r.id)}>Resource details</Button>
              )}
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0,1fr)",
                  md: "minmax(0,760px) minmax(240px,300px)",
                },
                gap: 3,
                alignItems: "start",
              }}
            >
              <Box>
                <Typography component="h3" variant="h3" sx={{ mb: 1.5 }}>
                  Proposed revisions
                </Typography>
                {!proposals.length && (
                  <Typography color="text.secondary">
                    No proposed files yet.
                  </Typography>
                )}
                {proposals.map((p) => (
                  <Box
                    key={p.id}
                    sx={{
                      border: 1,
                      borderColor: p.selected ? "primary.main" : "divider",
                      borderRadius: 1,
                      p: 1.5,
                      mb: 1.5,
                    }}
                  >
                    <Box sx={{ ...row, justifyContent: "space-between" }}>
                      <Typography
                        sx={{ fontWeight: 500, overflowWrap: "anywhere" }}
                      >
                        {p.name}
                      </Typography>
                      {p.submitted ? (
                        <Chip label="Submitted version" />
                      ) : (
                        p.selected && <Chip label="Selected by owner" />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {p.uploader} · {date(p.created)}
                    </Typography>
                    <Typography sx={{ mt: 1, mb: 1, whiteSpace: "pre-wrap" }}>
                      {p.changes}
                    </Typography>
                    <Box sx={row}>
                      {p.downloadUrl && !p.unavailable ? (
                        <Button
                          component="a"
                          href={p.downloadUrl}
                          download={p.name}
                        >
                          Download proposal
                        </Button>
                      ) : (
                        <Typography color="text.secondary">
                          File unavailable
                        </Typography>
                      )}
                      {owner && !locked && !p.selected && !p.submitted && (
                        <Button
                          disabled={busy}
                          onClick={() => void run("select", { proposal: p.id })}
                        >
                          Select this file
                        </Button>
                      )}
                    </Box>
                  </Box>
                ))}
                {!locked && (
                  <Box
                    component="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("propose");
                    }}
                    sx={{ mt: 2 }}
                  >
                    <TextField
                      label="Proposed changes"
                      required
                      multiline
                      minRows={2}
                      fullWidth
                      value={changes}
                      disabled={busy}
                      onChange={(e) => setChanges(e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 3000 } }}
                    />
                    <Box sx={{ ...row, mt: 1.5 }}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<UploadFileOutlined />}
                        disabled={busy}
                      >
                        Choose file
                        <input
                          hidden
                          type="file"
                          accept={fileAccept}
                          onChange={(e) => {
                            const next = e.target.files?.[0];
                            if (next) {
                              setFile(next);
                              staged.current = null;
                            }
                            e.target.value = "";
                          }}
                        />
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        {file?.name || fileHint}
                      </Typography>
                      <Button
                        type="submit"
                        disabled={busy || !file || !changes.trim()}
                      >
                        Save proposal
                      </Button>
                      {progress !== null && (
                        <Typography role="status">
                          Uploading {progress}%
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                {owner && !locked && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      disabled={
                        busy ||
                        !proposals.some((p) => p.selected && !p.submitted) ||
                        !!(comment || changes || file)
                      }
                      onClick={() => void run("submit")}
                      variant="contained"
                    >
                      Submit selected version
                    </Button>
                  </Box>
                )}
                <Divider sx={{ my: 3 }} />
                <Typography component="h3" variant="h3" sx={{ mb: 1.5 }}>
                  Discussion
                </Typography>
                {!detail?.comments?.length && (
                  <Typography color="text.secondary">
                    No comments yet.
                  </Typography>
                )}
                {detail?.comments?.map((c) => (
                  <Box key={c.id} sx={{ mb: 2 }}>
                    <Typography sx={{ fontWeight: 500 }}>
                      {c.name}{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                      >
                        · {date(c.created)}
                      </Typography>
                    </Typography>
                    <Typography
                      sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {c.body}
                    </Typography>
                  </Box>
                ))}
                {!locked && (
                  <Box
                    component="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("comment", { body: comment.trim() });
                    }}
                    sx={{ mt: 2 }}
                  >
                    <TextField
                      required
                      multiline
                      minRows={2}
                      fullWidth
                      label="Suggest a change or add a comment"
                      value={comment}
                      disabled={busy}
                      onChange={(e) => setComment(e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 5000 } }}
                    />
                    <Button
                      type="submit"
                      disabled={busy || !comment.trim()}
                      sx={{ mt: 1 }}
                    >
                      Post comment
                    </Button>
                  </Box>
                )}
              </Box>
              <Box component="aside">
                <Typography component="h3" variant="h3" sx={{ mb: 1.5 }}>
                  Contributors
                </Typography>
                <Typography sx={{ mb: 2 }}>
                  {(listing?.resources || []).find((p) => p.id === id)
                    ?.creator || person.name}{" "}
                  · Owner
                </Typography>
                {members
                  .filter(
                    (m) => m.status !== "removed" && m.status !== "declined",
                  )
                  .map((m) => (
                    <Box key={m.id} sx={{ mb: 1.5 }}>
                      <Typography>{m.name}</Typography>
                      <Box sx={row}>
                        <Typography variant="caption" color="text.secondary">
                          {m.status}
                        </Typography>
                        {owner && !locked && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void run("remove", { teacher: m.id })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </Box>
                    </Box>
                  ))}
                {owner && !locked && (
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    <TextField
                      select
                      label="Invite a teacher"
                      value={teacher}
                      disabled={busy}
                      onChange={(e) => setTeacher(e.target.value)}
                    >
                      <MenuItem value="">Choose teacher</MenuItem>
                      {listing?.teachers
                        ?.filter(
                          (t) =>
                            !members.some(
                              (m) =>
                                m.id === t.id &&
                                ["accepted", "invited"].includes(m.status),
                            ),
                        )
                        .map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name}
                          </MenuItem>
                        ))}
                    </TextField>
                    <Button
                      variant="outlined"
                      disabled={busy || !teacher}
                      onClick={() => void run("invite", { teacher })}
                    >
                      Send invitation
                    </Button>
                  </Stack>
                )}
              </Box>
            </Box>
          </>
        )
      )}
    </Box>
  );
}
