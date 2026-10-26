import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  Refresh,
  ViewKanbanOutlined,
  ViewListOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import {
  areas,
  date,
  grades,
  quarters,
  resourceState,
  submitted,
  summary,
} from "./domain";
import type { Coverage, Resource, SchoolState } from "./types";
import { Empty, ErrorNotice, Loading, ResourceCard, Status, row } from "./ui";
export async function readOverview(head: boolean) {
  const items = new Map<string, Resource>();
  let page = 1,
    result;
  do {
    result = await backend.bank.list(
      { scope: head ? "all" : "mine", sort: "oldest" },
      page++,
    );
    for (const item of result.items) items.set(item.id, item);
    if (items.size < result.total && (!result.items.length || page > 100000))
      throw Error("Resources changed while loading. Refresh and try again.");
  } while (items.size < result.total);
  return [...items.values()];
}
export function Summary({
  rows,
  state,
  epoch,
}: {
  rows: Resource[];
  state: SchoolState;
  epoch: number;
}) {
  const report = useMemo(
      () => summary(rows, state.teachers || []),
      [rows, state.teachers],
    ),
    [coverage, setCoverage] = useState<Coverage | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setCoverage(null);
    setError("");
    void backend.bank
      .competencyCoverage()
      .then((value) => {
        if (!cancelled) setCoverage(value);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [epoch]);
  const table = (
    title: string,
    headers: string[],
    data: (string | number)[][],
  ) => (
    <Box
      component="section"
      sx={{ maxWidth: headers.length === 2 ? 640 : 1000, mb: 4 }}
    >
      <Typography variant="h2" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <TableContainer
        sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <Table aria-label={title} size="small">
          <TableHead>
            <TableRow>
              {headers.map((h, i) => (
                <TableCell key={h} align={i ? "right" : "left"}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((cells, index) => (
              <TableRow key={index}>
                {cells.map((value, i) => (
                  <TableCell
                    align={i ? "right" : "left"}
                    component={i === 0 ? "th" : "td"}
                    scope={i === 0 ? "row" : undefined}
                    key={i}
                  >
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
  return (
    <>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Digital Bank submissions. Drafts and archived resources are excluded.
        Pending includes resubmissions.
      </Typography>
      {table(
        "Resources per teacher",
        ["Teacher", "Submitted", "Approved", "Pending", "Returned"],
        report.teachers.map((p) => [
          p.name,
          p.submitted,
          p.approved,
          p.pending,
          p.returned,
        ]),
      )}
      {table(
        "Approved resources per learning area",
        ["Learning area", "Approved"],
        report.areas.map(([name, count]) => [name, count]),
      )}
      <Box component="section" sx={{ maxWidth: 700 }}>
        <Typography variant="h2" component="h2" gutterBottom>
          Competency coverage
        </Typography>
        <ErrorNotice error={error} />
        <Typography color="text.secondary" role="status">
          {coverage
            ? coverage.catalog_empty
              ? "Coverage is unavailable until the competency list is prepared."
              : `${coverage.without_approved_resource} of ${coverage.verified_competencies} listed competencies have no approved resource.`
            : !error
              ? "Loading coverage…"
              : ""}
        </Typography>
      </Box>
    </>
  );
}
export function Overview({
  rows,
  state,
  loading,
  error,
  retry,
  onOpen,
  onSummary,
  onBank,
  onNotes,
}: {
  rows: Resource[];
  state: SchoolState;
  loading: boolean;
  error: string;
  retry: () => void;
  onOpen: (id: string) => void;
  onSummary: () => void;
  onBank: () => void;
  onNotes: () => void;
}) {
  const [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [subject, setSubject] = useState(""),
    [grade, setGrade] = useState(""),
    [term, setTerm] = useState(""),
    [layout, setLayout] = useState("board");
  const submittedRows = useMemo(() => submitted(rows), [rows]);
  const filtered = submittedRows.filter(
    (r) =>
      (status === "all" ||
        resourceState(r) === status ||
        (status === "pending" && resourceState(r) === "resubmitted")) &&
      (!subject || r.subject === subject) &&
      (!grade || r.grade === grade) &&
      (!term || r.term === term) &&
      `${r.title} ${r.subject} ${r.creator}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Box
        sx={{
          ...row,
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          mb: 2,
        }}
      >
        <Tabs
          value={status}
          onChange={(_, value) => setStatus(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Resource status"
        >
          <Tab value="all" label="All resources" />
          <Tab value="pending" label="Pending review" />
          <Tab value="returned" label="Revision needed" />
          <Tab value="approved" label="Approved" />
        </Tabs>
        {state.user.role === "head" && (
          <Button onClick={onSummary}>Teacher summary</Button>
        )}
      </Box>
      <Box sx={{ ...row, justifyContent: "space-between", mb: 2 }}>
        <TextField
          label="Search resources"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: "100%", maxWidth: 360 }}
        />
        <Box sx={row}>
          <Button startIcon={<Refresh fontSize="small" />} onClick={retry}>
            Refresh
          </Button>
          <ToggleButtonGroup
            exclusive
            value={layout}
            size="small"
            onChange={(_, value) => {
              if (value) setLayout(value);
            }}
            aria-label="Overview view"
          >
            <ToggleButton value="board" aria-label="Board view">
              <ViewKanbanOutlined fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <ViewListOutlined fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Box sx={{ ...row, mb: 2, gap: 1.5 }}>
        {[
          ["Learning area", subject, setSubject, areas],
          ["Grade", grade, setGrade, grades],
          ["Quarter", term, setTerm, quarters],
        ].map(([label, value, change, options]) => (
          <TextField
            key={String(label)}
            select
            label={String(label)}
            value={value as string}
            onChange={(e) => (change as (s: string) => void)(e.target.value)}
            sx={{ width: { xs: "100%", sm: 200 }, maxWidth: 280 }}
          >
            <MenuItem value="">All</MenuItem>
            {(options as string[]).map((option) => (
              <MenuItem value={option} key={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Box>
      <ErrorNotice error={error} retry={retry} />
      {loading ? (
        <Loading label="Loading Digital Bank resources…" />
      ) : !error && layout === "board" ? (
        <Box
          aria-label="Resource board"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0,340px)",
              sm: "repeat(2,minmax(0,340px))",
              lg: "repeat(3,minmax(0,340px))",
            },
            gap: 2,
            alignItems: "start",
          }}
        >
          {["pending", "returned", "approved"]
            .filter((key) => status === "all" || status === key)
            .map((key) => {
              const group = filtered.filter(
                (r) =>
                  resourceState(r) === key ||
                  (key === "pending" && resourceState(r) === "resubmitted"),
              );
              return (
                <Box key={key} sx={{ width: "100%", minWidth: 0 }}>
                  <Box sx={{ ...row, mb: 1.5 }}>
                    <Typography variant="h3" component="h2">
                      {key === "pending"
                        ? "Pending review"
                        : key === "returned"
                          ? "Revision needed"
                          : "Approved"}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {group.length}
                    </Typography>
                  </Box>
                  <Stack spacing={1}>
                    {group.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        showStatus={false}
                        onOpen={onOpen}
                      />
                    ))}
                    {!group.length && (
                      <Box
                        sx={{
                          border: "1px dashed",
                          borderColor: "divider",
                          p: 1.5,
                          color: "text.secondary",
                        }}
                      >
                        No resources
                      </Box>
                    )}
                  </Stack>
                </Box>
              );
            })}
        </Box>
      ) : !error ? (
        <TableContainer
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            maxWidth: 1100,
          }}
        >
          <Table size="small" aria-label="Overview resources">
            <TableHead>
              <TableRow>
                {["Resource", "Learning area", "Grade / quarter", "Status"].map(
                  (label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Button
                      sx={{ p: 0, textAlign: "left" }}
                      onClick={() => onOpen(r.id)}
                    >
                      {r.title}
                    </Button>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                    >
                      {r.creator}
                    </Typography>
                  </TableCell>
                  <TableCell>{r.subject}</TableCell>
                  <TableCell>
                    {r.grade} · {r.term}
                  </TableCell>
                  <TableCell>
                    <Status resource={r} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && (
            <Box sx={{ px: 2 }}>
              <Empty title="No resources match" />
            </Box>
          )}
        </TableContainer>
      ) : null}
      <Divider sx={{ my: 3 }} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0,1fr)",
            md: "repeat(3,minmax(0,340px))",
          },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Box component="section">
          <Box sx={{ ...row, justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="h3" component="h2">
              Digital Bank
            </Typography>
            <Button onClick={onBank}>Open resources</Button>
          </Box>
          <Box sx={{ ...row, gap: 2 }}>
            {[
              ["Submitted", submittedRows.length],
              [
                "Approved",
                submittedRows.filter((r) => resourceState(r) === "approved")
                  .length,
              ],
              [
                "Pending",
                submittedRows.filter((r) =>
                  ["pending", "resubmitted"].includes(resourceState(r)),
                ).length,
              ],
              [
                "Returned",
                submittedRows.filter((r) => resourceState(r) === "returned")
                  .length,
              ],
            ].map(([label, count]) => (
              <Box key={label}>
                <Typography sx={{ fontSize: 16 }}>
                  {loading ? "—" : count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="section">
          <Box sx={{ ...row, justifyContent: "space-between", mb: 1.5 }}>
            <Typography variant="h3" component="h2">
              Pinned notes
            </Typography>
            <Button onClick={onNotes}>Manage notes</Button>
          </Box>
          {state.notes
            .filter((note) => note.pinned)
            .slice(0, 3)
            .map((note) => (
              <Box
                key={note.id}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1.5,
                  mb: 1,
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>{note.title}</Typography>
                <Typography
                  color="text.secondary"
                  sx={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    mt: 0.5,
                  }}
                >
                  {note.body}
                </Typography>
              </Box>
            ))}
          {!state.notes.some((note) => note.pinned) && (
            <Typography color="text.secondary">No pinned notes.</Typography>
          )}
        </Box>
        <Box component="section">
          <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
            Recent resource updates
          </Typography>
          {[...submittedRows]
            .sort((a, b) => b.updated.localeCompare(a.updated))
            .slice(0, 3)
            .map((r) => (
              <Box key={r.id} sx={{ mb: 1.5 }}>
                <Button
                  onClick={() => onOpen(r.id)}
                  sx={{
                    p: 0,
                    minHeight: 0,
                    textAlign: "left",
                    justifyContent: "flex-start",
                  }}
                >
                  {r.title}
                </Button>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="p"
                  sx={{ mt: 0.5 }}
                >
                  {r.creator} · {date(r.updated)}
                </Typography>
              </Box>
            ))}
        </Box>
      </Box>
    </>
  );
}
