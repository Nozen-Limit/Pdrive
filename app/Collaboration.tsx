import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  GroupsOutlined,
  UploadFileOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import type { CollaborationState, Person } from "./types";
import { date } from "./domain";
import { Empty, ErrorNotice, Loading, row, type Confirm } from "./ui";
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
            "Choose a PDF or DOCX and describe the proposed changes.",
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
  const resources = (listing?.resources || []).filter(
    (r) =>
      (scope === "invitations"
        ? r.membership === "invited"
        : r.membership !== "invited") &&
      `${r.title} ${r.creator} ${r.subject}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Box sx={{ maxWidth: 1150 }}>
      <Box sx={{ ...row, justifyContent: "space-between", mb: 2 }}>
        {id ? (
          <Button
            startIcon={<ArrowBack />}
            onClick={() => void open(null)}
            disabled={busy}
          >
            Back to collaboration
          </Button>
        ) : (
          <Typography
            component="h2"
            sx={{
              fontSize: 16,
              fontWeight: 600,
              display: "flex",
              gap: 1,
              alignItems: "center",
            }}
          >
            <GroupsOutlined fontSize="small" />
            Shared faculty work
          </Typography>
        )}
        <Button onClick={() => setEpoch((n) => n + 1)} disabled={busy}>
          Refresh
        </Button>
      </Box>
      <ErrorNotice error={error} retry={() => setEpoch((n) => n + 1)} />
      {loading ? (
        <Loading label="Loading collaboration…" />
      ) : error && !listing ? null : !id ? (
        <>
          <Tabs
            value={scope}
            onChange={(_, value: string) => setScope(value)}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            <Tab value="drafts" label="Shared resources" />
            <Tab
              value="invitations"
              label={`Invitations (${(listing?.resources || []).filter((r) => r.membership === "invited").length})`}
            />
          </Tabs>
          <Box sx={{ ...row, mb: 2, justifyContent: "space-between" }}>
            <TextField
              label="Search resources"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ width: "100%", maxWidth: 400 }}
            />
            <Button onClick={onUpload} variant="outlined">
              New resource
            </Button>
          </Box>
          {!resources.length ? (
            <Empty
              title={
                scope === "invitations"
                  ? "No pending invitations"
                  : "No shared resources yet"
              }
            />
          ) : (
            <TableContainer sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Table size="small" aria-label="Collaboration resources">
                <TableHead>
                  <TableRow>
                    {[
                      "Resource",
                      "Owner",
                      "Learning area",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resources.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>
                        <Button
                          disabled={resource.membership === "invited"}
                          onClick={() => void open(resource.id)}
                          sx={{
                            textAlign: "left",
                            justifyContent: "flex-start",
                            p: 0,
                          }}
                        >
                          {resource.title}
                        </Button>
                        <Typography
                          variant="caption"
                          component="p"
                          color="text.secondary"
                        >
                          {resource.category} · {resource.grade} ·{" "}
                          {resource.term}
                        </Typography>
                      </TableCell>
                      <TableCell>{resource.creator}</TableCell>
                      <TableCell>{resource.subject}</TableCell>
                      <TableCell>
                        {resource.membership === "invited"
                          ? "Invitation"
                          : resource.bank_draft
                            ? "Shared draft"
                            : resource.status === "pending"
                              ? "In review · locked"
                              : resource.status}
                      </TableCell>
                      <TableCell>
                        {resource.membership === "invited" ? (
                          <Box sx={row}>
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  "respond",
                                  { status: "accepted" },
                                  resource.id,
                                )
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  "respond",
                                  { status: "declined" },
                                  resource.id,
                                )
                              }
                            >
                              Decline
                            </Button>
                          </Box>
                        ) : (
                          <Button onClick={() => void open(resource.id)}>
                            Open
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
                          accept=".pdf,.docx"
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
                        {file?.name || "PDF or DOCX · up to 20 MB"}
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
