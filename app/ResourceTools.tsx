import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  AttachFileOutlined,
  DeleteOutlined,
  FlagOutlined,
  Inventory2Outlined,
  LinkOutlined,
  ShareOutlined,
  UnarchiveOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import { date, fileAccept } from "./domain";
import type { Colleague, Person, ResourceDetail as Detail } from "./types";
import { FileTile, row } from "./ui";

const REPORT_REASONS = [
  "Wrong or broken file",
  "Error in the content",
  "Wrong grade, subject or competency",
  "Copyright concern",
  "Other",
];
const FILE_LABELS = [
  "Answer key",
  "Worksheet",
  "Rubric",
  "Teacher guide",
  "Other",
];
const shareLink = (id: string) =>
  `${location.origin}${location.pathname}#page=bank&resource=${id}`;

/** Share, report and personal-archive actions for the resource header. */
export function ResourceActions({
  detail,
  person,
  busy,
  onHidden,
  notify,
}: {
  detail: Detail;
  person: Person;
  busy: boolean;
  onHidden: (hidden: boolean) => void;
  notify: (text: string) => void;
}) {
  const r = detail.resource;
  const [dialog, setDialog] = useState<"share" | "report" | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [recipient, setRecipient] = useState<Colleague | null>(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const inBank = r.status === "approved" && !r.archived && !r.bank_draft;
  const own = r.owner === person.id;

  useEffect(() => {
    if (dialog !== "share" || colleagues.length) return;
    void backend.bank
      .colleagues()
      .then(setColleagues)
      .catch((e) => setError(message(e)));
  }, [dialog, colleagues.length]);

  const close = () => {
    setDialog(null);
    setError("");
    setText("");
    setRecipient(null);
  };
  async function run(task: () => Promise<void>, done: string) {
    setWorking(true);
    setError("");
    try {
      await task();
      close();
      notify(done);
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink(r.id));
      notify("Link copied.");
    } catch {
      setError("Copy the link from the box below.");
    }
  }
  async function toggleHidden() {
    setWorking(true);
    try {
      await backend.bank.hide(r.id, !detail.hidden);
      onHidden(!detail.hidden);
      notify(
        detail.hidden
          ? "Moved back to My Resources."
          : "Moved to My archive. Restore it any time.",
      );
    } catch (e) {
      notify(message(e));
    } finally {
      setWorking(false);
    }
  }
  const disabled = busy || working;
  return (
    <>
      {inBank && (
        <Button
          variant="outlined"
          startIcon={<ShareOutlined />}
          disabled={disabled}
          onClick={() => setDialog("share")}
        >
          Share
        </Button>
      )}
      {own && !!r.bank_category && (
        <Button
          variant="outlined"
          startIcon={
            detail.hidden ? <UnarchiveOutlined /> : <Inventory2Outlined />
          }
          disabled={disabled}
          onClick={() => void toggleHidden()}
          title={
            detail.hidden
              ? "Show it in My Resources again"
              : "Hide it from My Resources. Others are not affected."
          }
        >
          {detail.hidden ? "Restore to My Resources" : "Move to My archive"}
        </Button>
      )}
      {!own && (
        <Button
          color="inherit"
          startIcon={<FlagOutlined />}
          disabled={disabled}
          onClick={() => setDialog("report")}
          sx={{ color: "text.secondary" }}
        >
          Report a problem
        </Button>
      )}

      <Dialog open={dialog === "share"} onClose={close}>
        <DialogTitle>Share this resource</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
          <Box sx={{ ...row, flexWrap: "nowrap" }}>
            <TextField
              value={shareLink(r.id)}
              label="Link"
              fullWidth
              slotProps={{ input: { readOnly: true } }}
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outlined"
              startIcon={<LinkOutlined />}
              onClick={() => void copy()}
              sx={{ flexShrink: 0 }}
            >
              Copy
            </Button>
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            Or send it to a colleague. They get a notification that opens it.
          </Typography>
          <Autocomplete
            options={colleagues}
            value={recipient}
            onChange={(_, value) => setRecipient(value)}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Colleague" />
            )}
          />
          <TextField
            label="Note (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
          />
          {error && <Typography color="error">{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!recipient || working}
            onClick={() =>
              void run(
                () => backend.bank.share(r.id, recipient!.id, text.trim()),
                `Shared with ${recipient!.name}.`,
              )
            }
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "report"} onClose={close}>
        <DialogTitle>Report a problem</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
          <TextField
            select
            label="What is wrong?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REPORT_REASONS.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Details"
            multiline
            minRows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: page 3 is blank"
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            Head teachers are notified and will tell you when it is fixed.
          </Typography>
          {error && <Typography color="error">{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="contained"
            disabled={working}
            onClick={() =>
              void run(
                () => backend.bank.report(r.id, reason, text.trim()),
                "Report sent to the head teachers.",
              )
            }
          >
            Send report
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Reason shown to the author, review assignment and extra files. */
export function ResourceExtras({
  detail,
  person,
  onChanged,
  notify,
}: {
  detail: Detail;
  person: Person;
  onChanged: () => void;
  notify: (text: string) => void;
}) {
  const r = detail.resource;
  const own = r.owner === person.id;
  const head = person.role === "head";
  const editable =
    own && !r.archived && (r.bank_draft || r.status === "returned");
  const pending = !r.bank_draft && !r.archived && r.status === "pending";
  const files = detail.attachments || [];
  const [label, setLabel] = useState(FILE_LABELS[0]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function attach(file: File) {
    setWorking(true);
    setError("");
    try {
      await backend.validateBankFile(file);
      const key = await backend.bank.upload(r.id, file);
      await backend.bank.attach(r.id, key, label);
      notify(`${label} added.`);
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  }
  async function detach(id: string, name: string) {
    setWorking(true);
    setError("");
    try {
      await backend.bank.detach(id);
      notify(`${name} removed.`);
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  }
  async function assign(reviewer: string) {
    setWorking(true);
    setError("");
    try {
      await backend.bank.assign(r.id, reviewer || null);
      notify(reviewer ? "Review assigned." : "Assignment removed.");
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  }

  const panel = {
    border: 1,
    borderColor: "divider",
    bgcolor: "background.paper",
  } as const;
  return (
    <>
      {r.status === "rejected" && (own || head) && (
        <Box
          role="status"
          sx={(theme) => ({
            p: 2,
            borderLeft: 3,
            borderColor: "error.main",
            bgcolor: `color-mix(in srgb, ${theme.palette.error.main} 7%, transparent)`,
          })}
        >
          <Typography sx={{ fontWeight: 600 }}>
            This resource was not accepted
          </Typography>
          <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
            {r.rejected_reason}
          </Typography>
        </Box>
      )}

      {head && pending && !!detail.reviewers?.length && (
        <Box sx={{ ...panel, p: 2, ...row, gap: 1.5 }}>
          <Typography sx={{ fontWeight: 600, flex: "1 1 160px" }}>
            Reviewer
          </Typography>
          <TextField
            select
            value={r.assigned_reviewer || ""}
            onChange={(e) => void assign(e.target.value)}
            disabled={working}
            sx={{ minWidth: 240 }}
            label="Assigned to"
          >
            <MenuItem value="">Any head teacher</MenuItem>
            {detail.reviewers
              .filter((p) => p.id !== r.owner)
              .map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                  {p.role === "head" ? " · Head teacher" : " · Coordinator"}
                </MenuItem>
              ))}
          </TextField>
        </Box>
      )}

      {(files.length > 0 || editable) && (
        <Box component="section" sx={panel}>
          <Typography
            variant="h3"
            component="h3"
            sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider" }}
          >
            Extra files
          </Typography>
          {files.map((f) => (
            <Box
              key={f.id}
              sx={{
                ...row,
                flexWrap: "nowrap",
                gap: 1.5,
                px: 2.5,
                py: 1.25,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <FileTile name={f.name} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{f.label}</Typography>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 12, overflowWrap: "anywhere" }}
                >
                  {f.name} · {date(f.created)}
                </Typography>
              </Box>
              {f.downloadUrl && !f.unavailable && (
                <Link href={f.downloadUrl} download={f.name}>
                  Download
                </Link>
              )}
              {editable && (
                <IconButton
                  aria-label={`Remove ${f.label}`}
                  disabled={working}
                  onClick={() => void detach(f.id, f.label)}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {editable && files.length < 5 && (
            <Box sx={{ ...row, gap: 1.5, px: 2.5, py: 1.75 }}>
              <TextField
                select
                label="File type"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                {FILE_LABELS.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                startIcon={<AttachFileOutlined />}
                disabled={working}
                onClick={() => input.current?.click()}
              >
                {working ? "Uploading…" : "Add file"}
              </Button>
              <input
                ref={input}
                hidden
                type="file"
                accept={fileAccept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void attach(file);
                }}
              />
              <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                Up to 5 extra files, PDF or DOCX.
              </Typography>
            </Box>
          )}
          {error && (
            <Typography color="error" sx={{ px: 2.5, pb: 1.5 }}>
              {error}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}

/** "Not accepted" decision with a required reason. */
export function RejectButton({
  detail,
  disabled,
  onDone,
}: {
  detail: Detail;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  async function reject() {
    setWorking(true);
    setError("");
    try {
      await backend.bank.reject({
        mid: detail.resource.id,
        expected_revision: detail.resource.revision,
        reason: reason.trim(),
      });
      setOpen(false);
      await onDone();
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <Button color="error" disabled={disabled} onClick={() => setOpen(true)}>
        Don't accept
      </Button>
      <Dialog open={open} onClose={() => !working && setOpen(false)}>
        <DialogTitle>Don't accept this resource?</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
          <Typography color="text.secondary">
            Use this when the resource cannot be fixed with a revision. The
            teacher sees your reason and cannot resubmit this version.
          </Typography>
          <TextField
            label="Reason"
            multiline
            minRows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 3000 } }}
          />
          {error && <Typography color="error">{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!reason.trim() || working}
            onClick={() => void reject()}
          >
            Don't accept
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
