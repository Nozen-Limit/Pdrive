import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  DeleteOutlined,
  FileDownloadOutlined,
  PrintOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import { categories, date } from "./domain";
import type { Announcement, ProblemReport, ReportRow } from "./types";
import { ErrorNotice, Loading, row } from "./ui";

type Tab = "reports" | "announcements" | "export";
const panel = {
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
};

/** Head-teacher tools: problem reports, announcements and report export. */
export function HeadTools({
  onOpen,
  notify,
  confirm,
}: {
  onOpen: (id: string) => void;
  notify: (text: string) => void;
  confirm: (title: string, body: string, action?: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box
        role="tablist"
        aria-label="School tools"
        sx={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifySelf: "start",
          bgcolor: "action.hover",
          p: 0.375,
        }}
      >
        {(
          [
            ["reports", "Problem reports"],
            ["announcements", "Announcements"],
            ["export", "Export reports"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            sx={{
              px: 1.75,
              color: tab === value ? "text.primary" : "text.secondary",
              bgcolor: tab === value ? "background.paper" : "transparent",
              boxShadow: tab === value ? 1 : 0,
              "&:hover": {
                bgcolor: tab === value ? "background.paper" : "action.hover",
              },
            }}
          >
            {label}
          </Button>
        ))}
      </Box>
      {tab === "reports" && <Reports onOpen={onOpen} notify={notify} />}
      {tab === "announcements" && (
        <Announcements notify={notify} confirm={confirm} />
      )}
      {tab === "export" && <Export />}
    </Box>
  );
}

function Reports({
  onOpen,
  notify,
}: {
  onOpen: (id: string) => void;
  notify: (text: string) => void;
}) {
  const [items, setItems] = useState<ProblemReport[] | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void backend.bank
      .reports()
      .then(setItems)
      .catch((e) => setError(message(e)));
  }, [epoch]);
  async function resolve(id: string) {
    setBusy(true);
    try {
      await backend.bank.resolveReport(id, (notes[id] || "").trim());
      notify("Report resolved. The teacher was notified.");
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (error) return <ErrorNotice error={error} />;
  if (!items) return <Loading label="Loading reports…" />;
  if (!items.length)
    return (
      <Typography color="text.secondary" sx={{ py: 3 }}>
        No problems have been reported.
      </Typography>
    );
  return (
    <Box sx={panel}>
      {items.map((r) => (
        <Box
          key={r.id}
          sx={{
            display: "grid",
            gap: 1,
            px: 2.5,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            opacity: r.status === "resolved" ? 0.65 : 1,
          }}
        >
          <Box sx={{ ...row, justifyContent: "space-between" }}>
            <Button
              onClick={() => onOpen(r.module)}
              sx={{ p: 0, minHeight: 0, fontWeight: 600, textAlign: "left" }}
            >
              {r.title}
            </Button>
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {r.reporter} · {date(r.created)}
            </Typography>
          </Box>
          <Typography>
            <b>{r.reason}</b>
            {r.details ? ` · ${r.details}` : ""}
          </Typography>
          {r.status === "resolved" ? (
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Resolved {date(r.resolved)}
              {r.resolution ? `: ${r.resolution}` : ""}
            </Typography>
          ) : (
            <Box sx={{ ...row, flexWrap: "nowrap" }}>
              <TextField
                label="What you did (sent to the teacher)"
                value={notes[r.id] || ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [r.id]: e.target.value }))
                }
                fullWidth
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
              <Button
                variant="contained"
                disabled={busy}
                onClick={() => void resolve(r.id)}
                sx={{ flexShrink: 0 }}
              >
                Mark resolved
              </Button>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function Announcements({
  notify,
  confirm,
}: {
  notify: (text: string) => void;
  confirm: (title: string, body: string, action?: string) => Promise<boolean>;
}) {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [form, setForm] = useState({ title: "", body: "", expires: "" });
  useEffect(() => {
    void backend.bank
      .announcements()
      .then(setItems)
      .catch((e) => setError(message(e)));
  }, [epoch]);
  async function post(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await backend.bank.announce(
        form.title.trim(),
        form.body.trim(),
        form.expires,
      );
      setForm({ title: "", body: "", expires: "" });
      notify("Announcement posted for all teachers.");
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(a: Announcement) {
    if (!(await confirm("Remove announcement?", a.title, "Remove"))) return;
    try {
      await backend.bank.removeAnnouncement(a.id);
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0,1fr)", md: "380px minmax(0,1fr)" },
        gap: 2,
        alignItems: "start",
      }}
    >
      <Paper
        variant="outlined"
        component="form"
        onSubmit={post}
        sx={{ p: 2.5, display: "grid", gap: 2 }}
      >
        <Typography variant="h3">New announcement</Typography>
        <TextField
          label="Title"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Term 2 submissions close Friday"
          slotProps={{ htmlInput: { maxLength: 160 } }}
        />
        <TextField
          label="Message"
          multiline
          minRows={3}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          slotProps={{ htmlInput: { maxLength: 3000 } }}
        />
        <TextField
          label="Show until (optional)"
          type="date"
          value={form.expires}
          onChange={(e) => setForm({ ...form, expires: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <ErrorNotice error={error} />
        <Button type="submit" variant="contained" disabled={busy}>
          Post to all teachers
        </Button>
      </Paper>
      <Box sx={panel}>
        {!items ? (
          <Loading label="Loading announcements…" />
        ) : !items.length ? (
          <Typography color="text.secondary" sx={{ p: 2.5 }}>
            No current announcements.
          </Typography>
        ) : (
          items.map((a) => (
            <Box
              key={a.id}
              sx={{
                ...row,
                flexWrap: "nowrap",
                alignItems: "flex-start",
                px: 2.5,
                py: 2,
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{a.title}</Typography>
                {a.body && (
                  <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}>
                    {a.body}
                  </Typography>
                )}
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 12, mt: 0.5 }}
                >
                  {a.author} · {date(a.created)}
                  {a.expires ? ` · until ${date(a.expires)}` : ""}
                </Typography>
              </Box>
              <IconButton
                aria-label={`Remove ${a.title}`}
                onClick={() => void remove(a)}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

const COLUMNS: [keyof ReportRow, string][] = [
  ["teacher", "Teacher"],
  ["title", "Title"],
  ["subject", "Learning area"],
  ["grade", "Grade"],
  ["term", "Term"],
  ["category", "Category"],
  ["status", "Status"],
  ["version", "Version"],
  ["submitted", "Submitted"],
  ["approved", "Approved"],
  ["approver", "Approved by"],
];
const cell = (r: ReportRow, key: keyof ReportRow) => {
  const v = r[key];
  if (key === "category")
    return categories[v as keyof typeof categories] || String(v ?? "");
  if (key === "submitted" || key === "approved")
    return v ? date(String(v)) : "";
  return v == null ? "" : String(v);
};

function Export() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ teacher: "", subject: "", term: "" });
  useEffect(() => {
    void backend.bank
      .reportRows()
      .then(setRows)
      .catch((e) => setError(message(e)));
  }, []);
  const options = useMemo(() => {
    const pick = (k: keyof ReportRow) =>
      [...new Set((rows || []).map((r) => String(r[k] ?? "")))]
        .filter(Boolean)
        .sort();
    return {
      teacher: pick("teacher"),
      subject: pick("subject"),
      term: pick("term"),
    };
  }, [rows]);
  const shown = (rows || []).filter(
    (r) =>
      (!filter.teacher || r.teacher === filter.teacher) &&
      (!filter.subject || r.subject === filter.subject) &&
      (!filter.term || r.term === filter.term),
  );
  const title =
    "SIKAP resource report" +
    [filter.teacher, filter.subject, filter.term]
      .filter(Boolean)
      .map((x) => " · " + x)
      .join("");

  function excel() {
    // CSV with a byte-order mark opens directly in Excel with Filipino characters intact.
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const text =
      "﻿" +
      [
        COLUMNS.map(([, h]) => esc(h)).join(","),
        ...shown.map((r) => COLUMNS.map(([k]) => esc(cell(r, k))).join(",")),
      ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    link.download =
      title
        .replace(/[^\w\- ]+/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase() + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function pdf() {
    const win = window.open("", "_blank");
    if (!win) {
      setError("Allow pop-ups for this site to print or save as PDF.");
      return;
    }
    const esc = (s: string) =>
      s.replace(
        /[&<>]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
      );
    win.document.write(`<!doctype html><title>${esc(title)}</title>
<style>body{font:12px "Public Sans",Arial,sans-serif;margin:24px;color:#1f2a37}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#5f6b78}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #cfd6de;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eef2f7}
@page{size:landscape;margin:14mm}</style>
<h1>${esc(title)}</h1><p>${shown.length} resources · generated ${esc(new Date().toLocaleString())}</p>
<table><thead><tr>${COLUMNS.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${shown.map((r) => `<tr>${COLUMNS.map(([k]) => `<td>${esc(cell(r, k))}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    win.document.close();
    win.focus();
    win.print();
  }

  if (error) return <ErrorNotice error={error} />;
  if (!rows) return <Loading label="Loading resources…" />;
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ ...row, gap: 1.5 }}>
        {(
          [
            ["teacher", "Teacher"],
            ["subject", "Learning area"],
            ["term", "Term"],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            select
            label={label}
            value={filter[key]}
            onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {options[key].map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
        ))}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<PrintOutlined />}
          disabled={!shown.length}
          onClick={pdf}
        >
          Print or save as PDF
        </Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadOutlined />}
          disabled={!shown.length}
          onClick={excel}
        >
          Download for Excel
        </Button>
      </Box>
      <Typography color="text.secondary">
        {shown.length} {shown.length === 1 ? "resource" : "resources"}
      </Typography>
      <Box sx={{ ...panel, overflowX: "auto" }}>
        <Box
          component="table"
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 900,
            "& th, & td": {
              textAlign: "left",
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: "divider",
              fontSize: 12.5,
            },
            "& th": { color: "text.secondary", fontWeight: 500 },
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map(([k, h]) => (
                <th key={k}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 200).map((r, i) => (
              <tr key={i}>
                {COLUMNS.map(([k]) => (
                  <td key={k}>{cell(r, k)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
      {shown.length > 200 && (
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          Showing the first 200 rows. The download includes all {shown.length}.
        </Typography>
      )}
    </Box>
  );
}
