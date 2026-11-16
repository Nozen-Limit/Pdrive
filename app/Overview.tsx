import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { backend, message } from "./api";
import {
  areas,
  categories,
  date,
  grades,
  resourceState,
  submitted,
  summary,
} from "./domain";
import type {
  Coverage,
  Page,
  Person,
  Resource,
  SchoolState,
  Scope,
} from "./types";
import { ErrorNotice, FileTile, Loading, Status, initials, row } from "./ui";
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
              ? "No competency data"
              : `${coverage.without_approved_resource} of ${coverage.verified_competencies} listed competencies have no approved resource.`
            : !error
              ? "Loading coverage…"
              : ""}
        </Typography>
      </Box>
    </>
  );
}
/** Approved resources everyone can see, newest first, for Home's map of the
    bank. Capped so a very large bank cannot stall the page. */
const SHARED_PAGES = 20;
export async function readShared() {
  const items: Resource[] = [];
  let page = 1,
    total = 0;
  do {
    const result = await backend.bank.list(
      { scope: "shared", sort: "approved" },
      page++,
    );
    items.push(...result.items);
    total = result.total;
    if (!result.items.length) break;
  } while (items.length < total && page <= SHARED_PAGES);
  return { items, total };
}

export interface HomeData {
  user: Person;
  /** This person's resources; for a Head Teacher, every submitted resource. */
  rows: Resource[];
  /** Approved resources in the bank, or null while unavailable. */
  shared: { items: Resource[]; total: number } | null;
  invitations: number;
  pendingAccounts: number;
  coverage: Coverage | null;
}

const greeting = (hour: number) =>
  hour < 11
    ? "Magandang umaga"
    : hour < 13
      ? "Magandang tanghali"
      : hour < 18
        ? "Magandang hapon"
        : "Magandang gabi";

/** Learning areas down, grades across; each cell is how many approved
    resources the bank holds, so the empty ones show what to make next. */
function BankMap({
  shared,
  subjects,
  onBrowse,
}: {
  shared: Resource[];
  subjects: string[];
  onBrowse: (filters: Record<string, string>) => void;
}) {
  const counts = new Map<string, number>();
  for (const r of shared) {
    const key = r.subject + "|" + r.grade;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const most = Math.max(1, ...counts.values());
  // A teacher's own subjects come first.
  const ordered = [
    ...areas.filter((area) => subjects.includes(area)),
    ...areas.filter((area) => !subjects.includes(area)),
  ];
  return (
    <Box
      role="table"
      aria-label="Approved resources by learning area and grade"
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) repeat(4,minmax(40px,56px))",
        gap: "4px",
        alignItems: "center",
      }}
    >
      <Box role="row" sx={{ display: "contents" }}>
        <Box role="columnheader" />
        {grades.map((grade) => (
          <Typography
            role="columnheader"
            key={grade}
            variant="caption"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            G{grade.replace("Grade ", "")}
          </Typography>
        ))}
      </Box>
      {ordered.map((area) => (
        <Box role="row" key={area} sx={{ display: "contents" }}>
          <Typography
            role="rowheader"
            sx={{
              fontSize: 12,
              pr: 1,
              overflowWrap: "anywhere",
              fontWeight: subjects.includes(area) ? 600 : 400,
            }}
          >
            {area}
          </Typography>
          {grades.map((grade) => {
            const count = counts.get(area + "|" + grade) || 0,
              share = count / most;
            return (
              <Box role="cell" key={grade}>
                <ButtonBase
                  onClick={() => onBrowse({ subject: area, grade })}
                  aria-label={`${area}, ${grade}: ${count} approved`}
                  sx={(theme) => ({
                    width: "100%",
                    height: 32,
                    borderRadius: 0.5,
                    fontSize: 12,
                    fontWeight: count ? 600 : 400,
                    fontVariantNumeric: "tabular-nums",
                    // Deeper colour means more resources; empty cells stay
                    // hollow so the gaps are the first thing seen.
                    bgcolor: count
                      ? `color-mix(in srgb, ${theme.palette.primary.main} ${Math.round(
                          18 + 82 * share,
                        )}%, transparent)`
                      : "transparent",
                    border: count ? 0 : "1px dashed",
                    borderColor: "divider",
                    color: !count
                      ? "text.disabled"
                      : share > 0.5
                        ? "primary.contrastText"
                        : "text.primary",
                    "&:hover, &:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 1,
                    },
                  })}
                >
                  {count || "–"}
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

/** How the bank divides across the proposal's three kinds of resource:
    one bar split in proportion, with each count beside its name. */
function CategorySplit({
  shared,
  onBrowse,
}: {
  shared: Resource[];
  onBrowse: (filters: Record<string, string>) => void;
}) {
  const keys = Object.keys(categories) as (keyof typeof categories)[];
  const counts = keys.map(
    (key) =>
      shared.filter((r) => (r.category || r.bank_category) === key).length,
  );
  const strengths = [100, 58, 28];
  const tint = (index: number) => (theme: Theme) =>
    `color-mix(in srgb, ${theme.palette.primary.main} ${strengths[index]}%, transparent)`;
  if (!counts.some(Boolean)) return null;
  return (
    <Box>
      <Box
        aria-hidden
        sx={{
          display: "flex",
          gap: "2px",
          height: 10,
          borderRadius: 0.5,
          overflow: "hidden",
        }}
      >
        {keys.map(
          (key, index) =>
            counts[index] > 0 && (
              <Box
                key={key}
                sx={{ flexGrow: counts[index], bgcolor: tint(index) }}
              />
            ),
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 2.5,
          rowGap: 0.5,
          mt: 1,
        }}
      >
        {keys.map((key, index) => (
          <ButtonBase
            key={key}
            onClick={() => onBrowse({ category: key })}
            sx={{
              gap: 0.75,
              fontSize: 12,
              borderRadius: 0.5,
              "&:hover, &:focus-visible": { textDecoration: "underline" },
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "2px",
                bgcolor: tint(index),
              }}
            />
            {categories[key]}
            <Box
              component="span"
              sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {counts[index]}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

function Stat({
  label,
  value,
  of,
  hint,
}: {
  label: string;
  value: number;
  of?: number;
  hint?: string;
}) {
  const share = of ? value / of : 0;
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "grid", gap: 0.75 }}>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Box sx={{ ...row, gap: 1.5 }}>
        {of !== undefined && (
          <Box
            component="svg"
            viewBox="0 0 40 40"
            aria-hidden="true"
            sx={{ width: 40, height: 40, flexShrink: 0 }}
          >
            <Box
              component="circle"
              cx="20"
              cy="20"
              r="16"
              fill="none"
              strokeWidth="5"
              sx={{ stroke: (theme) => theme.palette.divider }}
            />
            <Box
              component="circle"
              cx="20"
              cy="20"
              r="16"
              fill="none"
              strokeWidth="5"
              strokeDasharray={`${(share * 100.5).toFixed(1)} 100.5`}
              transform="rotate(-90 20 20)"
              sx={{ stroke: (theme) => theme.palette.success.main }}
            />
          </Box>
        )}
        <Typography
          sx={{
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
          {of !== undefined && (
            <Box
              component="span"
              sx={{ fontSize: 14, color: "text.secondary", fontWeight: 500 }}
            >
              {" "}
              / {of}
            </Box>
          )}
        </Typography>
      </Box>
      {hint && (
        <Typography sx={{ fontSize: 11, color: "success.main" }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

const panelRows = {
  "& > div": { ...row, gap: 1.5, px: 2, py: 1.25 },
  "& > div + div": { borderTop: 1, borderColor: "divider" },
} as const;
function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" sx={{ minWidth: 0 }}>
      <Box
        sx={{ ...row, justifyContent: "space-between", px: 2, minHeight: 48 }}
      >
        <Box sx={{ ...row, gap: 1 }}>
          <Typography variant="h3" component="h2">
            {title}
          </Typography>
          {!!count && (
            <Box
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 500,
                color: "text.secondary",
                bgcolor: "action.selected",
                px: 1,
                lineHeight: "20px",
              }}
            >
              {count}
            </Box>
          )}
        </Box>
        {action}
      </Box>
      <Divider />
      {children}
    </Paper>
  );
}

/** Home, drawn from data it is given so it can be previewed without an
    account (see app/main.tsx). */
export function HomeView({
  data,
  hour,
  onOpen,
  onSummary,
  go,
  onBrowse,
}: {
  data: HomeData;
  hour: number;
  onOpen: (id: string) => void;
  onSummary: () => void;
  go: (page: Page, scope?: Scope) => void;
  onBrowse: (filters: Record<string, string>) => void;
}) {
  const { user, rows, shared, invitations, pendingAccounts, coverage } = data;
  const head = user.role === "head",
    me = user.id;
  const mine = rows.filter((r) => r.owner === me),
    returned = mine.filter((r) => resourceState(r) === "returned"),
    drafts = mine.filter((r) => resourceState(r) === "draft"),
    review = head
      ? rows.filter(
          (r) =>
            r.owner !== me &&
            ["pending", "resubmitted"].includes(resourceState(r)),
        )
      : [];
  // One resource opens directly; several open the list that holds them.
  const openOr = (items: Resource[], scope: Scope) => () =>
    items.length === 1 ? onOpen(items[0].id) : go("bank", scope);
  const todo = [
    {
      count: review.length,
      title: "Waiting for your review",
      detail:
        review.length === 1
          ? `${review[0].title}, from ${review[0].creator}`
          : "Approve, or return with feedback",
      action: "Review",
      run: openOr(review, "review"),
    },
    {
      count: pendingAccounts,
      title:
        pendingAccounts === 1
          ? "Account waiting for approval"
          : "Accounts waiting for approval",
      detail: "New teacher sign-ups",
      action: "Open",
      run: () => go("teachers"),
    },
    {
      count: returned.length,
      title: "Returned for revision",
      detail:
        returned.length === 1
          ? returned[0].title
          : "Read the feedback and upload a revised file",
      action: "Open",
      run: openOr(returned, "mine"),
    },
    {
      count: drafts.length,
      title:
        drafts.length === 1 ? "Draft not submitted" : "Drafts not submitted",
      detail: drafts.length === 1 ? drafts[0].title : "Finish and submit them",
      action: "Continue",
      run: openOr(drafts, "mine"),
    },
    {
      count: invitations,
      title:
        invitations === 1
          ? "Collaboration invitation"
          : "Collaboration invitations",
      detail: "Accept or decline",
      action: "Reply",
      run: () => go("collaboration"),
    },
  ].filter((item) => item.count > 0);

  const mineSubmitted = submitted(mine),
    mineApproved = mineSubmitted.filter(
      (r) => resourceState(r) === "approved",
    ).length;
  const bankTotal = shared?.total ?? 0;
  const subjects = user.subjects || [];
  const empty = shared
    ? areas.flatMap((area) =>
        grades
          .filter(
            (grade) =>
              !shared.items.some(
                (r) => r.subject === area && r.grade === grade,
              ),
          )
          .map((grade) => ({ area, grade })),
      )
    : [];
  const myGaps = empty.filter((gap) => subjects.includes(gap.area));
  const fromOthers = (shared?.items || [])
    .filter((r) => r.owner !== me)
    .slice(0, 4);
  const recent = mine
    .filter((r) => !r.archived)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 4);

  const meta = (r: Resource) =>
    [r.bank_resource_type, r.subject, r.grade, r.term]
      .filter(Boolean)
      .join(" · ");
  const titleLink = (r: Resource) => (
    <Button
      onClick={() => onOpen(r.id)}
      sx={{
        p: 0,
        minHeight: 0,
        textAlign: "left",
        justifyContent: "flex-start",
        fontWeight: 500,
        overflowWrap: "anywhere",
      }}
    >
      {r.title}
    </Button>
  );
  const note = (text: string) => (
    <Typography color="text.secondary" sx={{ px: 2, py: 2 }}>
      {text}
    </Typography>
  );
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0,1fr)",
          lg: "minmax(0,1fr) minmax(0,440px)",
        },
        gap: 3,
        maxWidth: 1180,
        alignItems: "start",
      }}
    >
      <Box
        component="header"
        sx={{
          gridColumn: "1 / -1",
          ...row,
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Typography
          component="p"
          sx={{ fontSize: 24, fontWeight: 600, lineHeight: 1.25 }}
        >
          {greeting(hour)}, {user.name}
        </Typography>
      </Box>

      <Box
        sx={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0,1fr))",
            md: "repeat(4, minmax(0,1fr))",
          },
          gap: 1.5,
        }}
      >
        <Stat
          label="To do"
          value={todo.reduce((sum, item) => sum + item.count, 0)}
        />
        <Stat
          label="Your approved"
          value={mineApproved}
          of={mineSubmitted.length}
        />
        <Stat
          label={head ? "Waiting for review" : "In review"}
          value={
            head
              ? review.length
              : mine.filter((r) =>
                  ["pending", "resubmitted"].includes(resourceState(r)),
                ).length
          }
        />
        <Stat label="Digital Bank" value={bankTotal} />
      </Box>

      <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
        <Panel
          title="To do"
          count={todo.reduce((sum, item) => sum + item.count, 0)}
        >
          {todo.length ? (
            <Box sx={panelRows}>
              {todo.map((item) => (
                <Box key={item.title}>
                  <Box
                    sx={(theme) => ({
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      bgcolor: `color-mix(in srgb, ${theme.palette.primary.main} 12%, transparent)`,
                    })}
                  >
                    {item.count}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <Typography sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {item.detail}
                    </Typography>
                  </Box>
                  <Button variant="outlined" onClick={item.run}>
                    {item.action}
                  </Button>
                </Box>
              ))}
            </Box>
          ) : (
            note("Nothing needs you right now.")
          )}
        </Panel>

        {fromOthers.length > 0 && (
          <Panel
            title="New from your colleagues"
            action={
              <Button onClick={() => go("bank", "shared")}>View all</Button>
            }
          >
            <Box sx={panelRows}>
              {fromOthers.map((r) => (
                <Box key={r.id}>
                  <FileTile name={r.filename} />
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    {titleLink(r)}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      sx={{ ...row, gap: 0.75, overflowWrap: "anywhere" }}
                    >
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          display: "inline-grid",
                          placeItems: "center",
                          fontSize: 8,
                          fontWeight: 700,
                          color: "background.paper",
                          bgcolor: "primary.main",
                        }}
                      >
                        {initials(r.creator)}
                      </Box>
                      {[r.creator, meta(r)].filter(Boolean).join(" · ")}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {date(r.approved || r.updated)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Panel>
        )}

        <Panel
          title="Your resources"
          action={
            recent.length > 0 && (
              <Button onClick={() => go("bank", "mine")}>See all</Button>
            )
          }
        >
          {recent.length ? (
            <Box sx={panelRows}>
              {recent.map((r) => (
                <Box key={r.id}>
                  <FileTile name={r.filename} />
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    {titleLink(r)}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                    >
                      Updated {date(r.updated)}
                    </Typography>
                  </Box>
                  <Status resource={r} />
                </Box>
              ))}
            </Box>
          ) : (
            note("You have not uploaded a resource yet.")
          )}
        </Panel>
      </Box>

      {shared && (
        <Panel
          title="What the bank holds"
          action={head && <Button onClick={onSummary}>Teacher summary</Button>}
        >
          {shared.total > 0 && (
            <>
              <Box sx={{ p: 2 }}>
                <CategorySplit shared={shared.items} onBrowse={onBrowse} />
              </Box>
              <Divider />
            </>
          )}
          <Box sx={{ p: 2 }}>
            <BankMap
              shared={shared.items}
              subjects={subjects}
              onBrowse={onBrowse}
            />
          </Box>
          {head && coverage && !coverage.catalog_empty && (
            <>
              <Divider />
              <Typography sx={{ p: 2 }}>
                {coverage.without_approved_resource} of{" "}
                {coverage.verified_competencies} listed competencies have no
                approved resource.
              </Typography>
            </>
          )}
        </Panel>
      )}
    </Box>
  );
}

/** Loads what Home needs, then draws it. */
export function Overview({
  rows,
  state,
  loading,
  error,
  epoch,
  retry,
  onOpen,
  onSummary,
  go,
  onBrowse,
}: {
  rows: Resource[];
  state: SchoolState;
  loading: boolean;
  error: string;
  epoch: number;
  retry: () => void;
  onOpen: (id: string) => void;
  onSummary: () => void;
  go: (page: Page, scope?: Scope) => void;
  onBrowse: (filters: Record<string, string>) => void;
}) {
  const head = state.user.role === "head";
  const [invitations, setInvitations] = useState(0),
    [coverage, setCoverage] = useState<Coverage | null>(null),
    [shared, setShared] = useState<HomeData["shared"]>(null);
  useEffect(() => {
    let cancelled = false;
    // Each of these is an extra: Home still works if one is unavailable.
    void readShared()
      .then((value) => {
        if (!cancelled) setShared(value);
      })
      .catch(() => {});
    void backend.bank
      .collaboration()
      .then((value) => {
        if (!cancelled)
          setInvitations(
            (value.resources || []).filter((r) => r.membership === "invited")
              .length,
          );
      })
      .catch(() => {});
    if (head)
      void backend.bank
        .competencyCoverage()
        .then((value) => {
          if (!cancelled) setCoverage(value);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [epoch, head]);
  if (loading) return <Loading label="Loading your work…" />;
  if (error) return <ErrorNotice error={error} retry={retry} />;
  return (
    <HomeView
      data={{
        user: state.user,
        rows,
        shared,
        invitations,
        coverage,
        pendingAccounts: head
          ? (state.teachers || []).filter(
              (p) => p.approval_status === "pending",
            ).length
          : 0,
      }}
      hour={new Date().getHours()}
      onOpen={onOpen}
      onSummary={onSummary}
      go={go}
      onBrowse={onBrowse}
    />
  );
}
