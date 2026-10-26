import { useBusy } from "./operations";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  FilterList,
  GridViewOutlined,
  MoreVert,
  Refresh,
  Search,
  ViewKanbanOutlined,
  ViewListOutlined,
} from "@mui/icons-material";
import { backend, message } from "./api";
import {
  areas,
  categories,
  date,
  grades,
  quarters,
  resourceState,
  statusLabels,
} from "./domain";
import type { PageResult, Resource, Scope } from "./types";
import {
  Empty,
  ErrorNotice,
  Loading,
  ResourceCard,
  Status,
  row,
  type Confirm,
} from "./ui";
export async function downloadResource(id: string) {
  const detail = await backend.bank.details(id),
    file = detail.versions[0];
  if (!file?.downloadUrl || file.unavailable)
    throw Error("The file is unavailable. Refresh and try again.");
  const link = document.createElement("a");
  link.href = file.downloadUrl;
  link.download = file.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
export function Library({
  scope,
  head,
  userId,
  onScope,
  onOpen,
  onEdit,
  onUpload,
  epoch,
  onChanged,
  confirm,
  notify,
  categoryRequest,
}: {
  scope: Scope;
  head: boolean;
  userId: string;
  onScope: (scope: Scope) => void;
  onOpen: (id: string) => void;
  onEdit: (r: Resource) => void;
  onUpload: () => void;
  epoch: number;
  onChanged: () => Promise<void>;
  confirm: Confirm;
  notify: (value: string) => void;
  categoryRequest: { value: string; key: number };
}) {
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCounts(null);
    Promise.all(
      Object.keys(categories).map(
        async (category) =>
          [
            category,
            (await backend.bank.list({ scope: "shared", category }, 1)).total,
          ] as const,
      ),
    )
      .then((values) => {
        if (!cancelled) setCounts(Object.fromEntries(values));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [epoch, userId]);
  const [filters, setFilters] = useState<Record<string, string>>({
      sort: "approved",
    }),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<PageResult<Resource> | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filterOpen, setFilterOpen] = useState(false),
    [layout, setLayout] = useState<"list" | "grid" | "board">(() => {
      const saved = sessionStorage.getItem("sikap-react-layout");
      return saved === "grid" || saved === "board" ? saved : "list";
    }),
    [menu, setMenu] = useState<{
      anchor: HTMLElement;
      resource: Resource;
    } | null>(null),
    [actionBusy, setActionBusy] = useBusy(),
    [refresh, setRefresh] = useState(0),
    [creators, setCreators] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setFilters((old) => ({ ...old, q: query }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let cancelled = false;
    void backend.bank
      .facets()
      .then((value) => {
        if (!cancelled) setCreators(value.creators);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void backend.bank
      .list({ ...JSON.parse(filterKey), scope }, page)
      .then((value) => {
        if (!cancelled) setResult(value);
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
  }, [scope, page, filterKey, epoch, refresh, userId]);
  useEffect(() => {
    setPage(1);
  }, [scope]);
  const filter = (name: string, value: string) => {
    setPage(1);
    setFilters((old) => ({ ...old, [name]: value }));
  };
  useEffect(() => {
    if (categoryRequest.key) filter("category", categoryRequest.value);
  }, [categoryRequest.key]);
  async function action(kind: "download" | "save" | "archive" | "delete") {
    if (!menu || actionBusy) return;
    const r = menu.resource;
    setMenu(null);
    if (
      kind === "archive" &&
      !(await confirm(
        r.archived ? "Restore resource?" : "Archive resource?",
        r.archived
          ? "The resource will return to its previous review status."
          : "The resource will leave the shared Digital Bank. Files and review history will be preserved.",
        r.archived ? "Restore" : "Archive",
      ))
    )
      return;
    if (
      kind === "delete" &&
      !(await confirm(
        "Delete draft?",
        "This permanently removes this unsubmitted draft. Submitted versions cannot be deleted here.",
        "Delete draft",
      ))
    )
      return;
    setActionBusy(true);
    setError("");
    try {
      if (kind === "download") await downloadResource(r.id);
      if (kind === "save") await backend.bank.saved(r.id, !r.saved);
      if (kind === "archive")
        await backend.bank.archive({
          mid: r.id,
          expected_revision: r.revision,
          archive: !r.archived,
        });
      if (kind === "delete")
        await backend.bank.deleteDraft({
          mid: r.id,
          expected_revision: r.revision,
        });
      if (kind !== "download") {
        await onChanged();
        setRefresh((n) => n + 1);
        notify(
          kind === "save"
            ? r.saved
              ? "Removed from saved resources."
              : "Resource saved."
            : kind === "delete"
              ? "Draft deleted."
              : r.archived
                ? "Resource restored."
                : "Resource archived.",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setActionBusy(false);
    }
  }
  const actions = (r: Resource) => (
    <IconButton
      size="small"
      aria-label={`Actions for ${r.title}`}
      disabled={actionBusy}
      onClick={(e) => {
        e.stopPropagation();
        setMenu({ anchor: e.currentTarget, resource: r });
      }}
    >
      <MoreVert fontSize="small" />
    </IconButton>
  );
  const rows = result?.items || [];
  const showStatus = !["shared", "recent"].includes(scope);
  const search = (
    <TextField
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search resources"
      label="Search resources"
      slotProps={{
        input: {
          startAdornment: (
            <Search fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
          ),
        },
      }}
      sx={{ width: "100%", maxWidth: desktop ? 520 : 360 }}
    />
  );
  return (
    <>
      <Tabs
        value={scope}
        onChange={(_, value: Scope) => onScope(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
        aria-label="Resource collections"
      >
        <Tab value="shared" label="Digital Bank" />
        <Tab value="mine" label="My Resources" />
        <Tab value="saved" label="Saved" />
        {head && <Tab value="all" label="All resources" />}
        {head && <Tab value="review" label="Review queue" />}
        {scope === "archived" && (
          <Tab value="archived" label="Archived resources" />
        )}
        {scope === "recent" && <Tab value="recent" label="Recent" />}
      </Tabs>
      {scope === "shared" && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0,1fr)",
              sm: "repeat(3,minmax(0,240px))",
            },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          {Object.entries(categories).map(([key, label]) => (
            <Button
              key={key}
              variant="outlined"
              color="inherit"
              onClick={() =>
                filter("category", filters.category === key ? "" : key)
              }
              aria-pressed={filters.category === key}
              sx={{
                textAlign: "left",
                display: "block",
                p: 1.5,
                borderColor:
                  filters.category === key ? "primary.main" : "divider",
                bgcolor:
                  filters.category === key ? "action.selected" : undefined,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
                {key[0] + key.slice(1).toLowerCase()}
                <Box
                  component="span"
                  sx={{ float: "right", fontSize: 18, lineHeight: 1, pl: 2 }}
                  aria-label={`${key} approved resources`}
                >
                  {counts?.[key] ?? "—"}
                </Box>
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11, mt: 0.5 }}>
                {label}
              </Typography>
            </Button>
          ))}
        </Box>
      )}
      <Box sx={{ ...row, justifyContent: "space-between", mb: 2, gap: 1.5 }}>
        {desktop && document.getElementById("desktop-bank-search") ? (
          createPortal(search, document.getElementById("desktop-bank-search")!)
        ) : (
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources"
            label="Search resources"
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
            sx={{ width: "100%", maxWidth: 360 }}
          />
        )}
        <Box sx={{ ...row, width: desktop ? "100%" : undefined }}>
          <Button
            color="inherit"
            startIcon={<FilterList fontSize="small" />}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            Filters
          </Button>
          {desktop && (
            <>
              <Box sx={{ flexGrow: 1 }} />
              <TextField
                select
                label="Sort"
                value={filters.sort || "approved"}
                onChange={(e) => filter("sort", e.target.value)}
                sx={{ width: 180 }}
              >
                {[
                  ["approved", "Recently approved"],
                  ["updated", "Recently modified"],
                  ["name", "Name"],
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["creator", "Creator"],
                ].map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          <IconButton
            aria-label="Refresh resources"
            onClick={() => setRefresh((n) => n + 1)}
          >
            <Refresh fontSize="small" />
          </IconButton>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={layout}
            onChange={(_, value) => {
              if (value) {
                setLayout(value);
                sessionStorage.setItem("sikap-react-layout", value);
              }
            }}
            aria-label="Resource view"
          >
            <ToggleButton value="board" aria-label="Board view">
              <ViewKanbanOutlined fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <ViewListOutlined fontSize="small" />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="Grid view">
              <GridViewOutlined fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Collapse in={filterOpen}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2,minmax(0,220px))",
              lg: "repeat(3,minmax(0,220px))",
            },
            gap: 1.5,
            alignItems: "start",
            py: 1,
            mb: 2,
          }}
        >
          {[
            ["category", "Category", Object.keys(categories)],
            ["subject", "Learning area", areas],
            ["grade", "Grade", grades],
            ["term", "Quarter", quarters],
            ["creator", "Creator", creators],
            ["status", "Status", Object.keys(statusLabels)],
          ].map(([name, label, items]) => (
            <TextField
              key={String(name)}
              select
              label={String(label)}
              value={filters[String(name)] || ""}
              onChange={(e) => filter(String(name), e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {(items as string[]).map((value) => (
                <MenuItem key={value} value={value}>
                  {name === "status"
                    ? statusLabels[value as keyof typeof statusLabels]
                    : value}
                </MenuItem>
              ))}
            </TextField>
          ))}
          <TextField
            select
            label="File type"
            value={filters.type || ""}
            onChange={(e) => filter("type", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="application/pdf">PDF</MenuItem>
            <MenuItem value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
              DOCX
            </MenuItem>
          </TextField>
          <TextField
            select
            label="Sort"
            value={filters.sort || "approved"}
            onChange={(e) => filter("sort", e.target.value)}
          >
            {[
              ["approved", "Recently approved"],
              ["updated", "Recently modified"],
              ["name", "Name"],
              ["newest", "Newest"],
              ["oldest", "Oldest"],
              ["creator", "Creator"],
            ].map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Modified since"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.date || ""}
            onChange={(e) => filter("date", e.target.value)}
          />
          <Button
            sx={{ justifySelf: "start" }}
            onClick={() => {
              setQuery("");
              setFilters({ sort: "approved" });
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        </Box>
      </Collapse>
      <ErrorNotice error={error} retry={() => setRefresh((n) => n + 1)} />
      {loading ? (
        <Loading label="Loading resources…" />
      ) : !error && !rows.length ? (
        <Empty
          title={
            scope === "review"
              ? "No resources are waiting for review"
              : "No resources found"
          }
        >
          Resources matching this collection and its filters will appear here.
          {scope === "mine" && (
            <Box sx={{ mt: 2 }}>
              <Button onClick={onUpload} variant="outlined">
                Upload resource
              </Button>
            </Box>
          )}
        </Empty>
      ) : (
        !error && (
          <>
            {layout === "grid" ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill,minmax(min(100%,260px),1fr))",
                  maxWidth: 1120,
                  alignItems: "start",
                  gap: 1.5,
                }}
              >
                {rows.map((r) => (
                  <Box
                    key={r.id}
                    sx={{ position: "relative", width: "100%", maxWidth: 340 }}
                  >
                    <ResourceCard
                      resource={r}
                      onOpen={onOpen}
                      showStatus={showStatus}
                    />
                    <Box sx={{ position: "absolute", top: 8, right: 5 }}>
                      {actions(r)}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : layout === "board" ? (
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 2,
                  alignItems: "flex-start",
                }}
              >
                {(
                  [
                    ...(rows.some((r) => resourceState(r) === "draft")
                      ? ["draft"]
                      : []),
                    "pending",
                    "returned",
                    "approved",
                    ...(scope === "archived" ? ["archived"] : []),
                  ] as const
                ).map((state) => (
                  <Box
                    key={state}
                    sx={{ flex: "0 1 340px", width: "100%", minWidth: 0 }}
                  >
                    <Box sx={{ ...row, mb: 1.5 }}>
                      <Typography variant="h3">
                        {statusLabels[state as keyof typeof statusLabels]}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {
                          rows.filter(
                            (r) =>
                              resourceState(r) === state ||
                              (state === "pending" &&
                                resourceState(r) === "resubmitted"),
                          ).length
                        }
                      </Typography>
                    </Box>
                    <Stack spacing={1}>
                      {rows
                        .filter(
                          (r) =>
                            resourceState(r) === state ||
                            (state === "pending" &&
                              resourceState(r) === "resubmitted"),
                        )
                        .map((r) => (
                          <ResourceCard
                            key={r.id}
                            resource={r}
                            showStatus={false}
                            onOpen={onOpen}
                          />
                        ))}
                      {!rows.some(
                        (r) =>
                          resourceState(r) === state ||
                          (state === "pending" &&
                            resourceState(r) === "resubmitted"),
                      ) && (
                        <Box
                          sx={{
                            border: "1px dashed",
                            borderColor: "divider",
                            p: 1.5,
                            color: "text.secondary",
                            fontSize: 12,
                          }}
                        >
                          No resources
                        </Box>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Box>
            ) : (
              <TableContainer
                sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
              >
                <Table
                  size="small"
                  aria-label="Digital Bank resources"
                  sx={{ minWidth: 720 }}
                >
                  <TableHead>
                    <TableRow>
                      {[
                        "Resource",
                        "Category",
                        "Learning area",
                        "Grade",
                        "Creator",
                        "Modified",
                        ...(showStatus ? ["Status"] : []),
                        "Actions",
                      ].map((label) => (
                        <TableCell key={label}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow hover key={r.id}>
                        <TableCell sx={{ maxWidth: 340, minWidth: 180 }}>
                          <Button
                            onClick={() => onOpen(r.id)}
                            sx={{
                              p: 0,
                              minHeight: 0,
                              textAlign: "left",
                              justifyContent: "flex-start",
                              whiteSpace: "normal",
                              lineHeight: 1.6,
                            }}
                          >
                            {r.title}
                          </Button>
                          <Typography
                            variant="caption"
                            component="p"
                            color="text.secondary"
                          >
                            {r.term} · {r.filename || "Draft"}
                          </Typography>
                          {!!r.contributors?.length && (
                            <Typography
                              variant="caption"
                              component="p"
                              color="text.secondary"
                            >
                              Contributors:{" "}
                              {r.contributors.map((p) => p.name).join(", ")}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.subject}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {r.grade}
                        </TableCell>
                        <TableCell>{r.creator}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {date(r.updated)}
                        </TableCell>
                        {showStatus && (
                          <TableCell>
                            <Status resource={r} />
                          </TableCell>
                        )}
                        <TableCell>{actions(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <TablePagination
              component="div"
              count={result?.total || 0}
              page={page - 1}
              onPageChange={(_, value) => setPage(value + 1)}
              rowsPerPage={25}
              rowsPerPageOptions={[25]}
            />
          </>
        )
      )}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) onOpen(menu.resource.id);
            setMenu(null);
          }}
        >
          Open resource
        </MenuItem>
        {menu && resourceState(menu.resource) !== "draft" && (
          <MenuItem onClick={() => void action("download")}>Download</MenuItem>
        )}
        {menu && !menu.resource.archived && (
          <MenuItem onClick={() => void action("save")}>
            {menu.resource.saved ? "Remove from saved" : "Save resource"}
          </MenuItem>
        )}
        {menu &&
          menu.resource.owner === userId &&
          resourceState(menu.resource) === "draft" && (
            <MenuItem
              onClick={() => {
                onEdit(menu.resource);
                setMenu(null);
              }}
            >
              Edit draft
            </MenuItem>
          )}
        {menu &&
          menu.resource.owner === userId &&
          resourceState(menu.resource) === "draft" && (
            <MenuItem onClick={() => void action("delete")}>
              Delete draft
            </MenuItem>
          )}
        {menu && head && resourceState(menu.resource) !== "draft" && (
          <MenuItem onClick={() => void action("archive")}>
            {menu.resource.archived ? "Restore" : "Archive"}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
