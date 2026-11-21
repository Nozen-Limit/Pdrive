import { useBusy } from "./operations";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  ArchiveOutlined,
  Bookmark,
  BookmarkBorderOutlined,
  DownloadOutlined,
  ExpandMore,
  Refresh,
  RestoreOutlined,
  UploadFileOutlined,
} from "@mui/icons-material";
import { backend, message, resourceDetails } from "./api";
import {
  categories,
  criteria,
  date,
  fileAccept,
  fileHint,
  resourceState,
} from "./domain";
import type { Person, Resource, ResourceDetail as Detail } from "./types";
import { RejectButton, ResourceActions, ResourceExtras } from "./ResourceTools";
const FilePreview = lazy(() =>
  import("./FilePreview").then((module) => ({ default: module.FilePreview })),
);
import {
  ErrorNotice,
  FileTile,
  Loading,
  Status,
  initials,
  row,
  type Confirm,
} from "./ui";
export function ResourceDetail({
  id,
  person,
  workflowReady,
  epoch,
  onBack,
  onEdit,
  onChanged,
  confirm,
  notify,
  setDirty,
}: {
  id: string;
  person: Person;
  workflowReady: boolean;
  epoch: number;
  onBack: () => void;
  onEdit: (r: Resource) => void;
  onChanged: () => Promise<void>;
  confirm: Confirm;
  notify: (text: string) => void;
  setDirty: (value: boolean) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useBusy(),
    [retry, setRetry] = useState(0),
    [revisionFile, setRevisionFile] = useState<File | null>(null),
    [progress, setProgress] = useState<number | null>(null);
  const receipt = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void resourceDetails(id)
      .then((value) => {
        if (!cancelled) setDetail(value);
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
  }, [id, epoch, retry, person.id]);
  async function archive() {
    if (!detail || busy) return;
    const r = detail.resource;
    if (
      !(await confirm(
        r.archived ? "Restore resource?" : "Archive resource?",
        r.archived
          ? "This restores its previous review status and makes approved resources available again."
          : "Its files, creator information and review history will be preserved.",
        r.archived ? "Restore" : "Archive",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await backend.bank.archive({
        mid: r.id,
        expected_revision: r.revision,
        archive: !r.archived,
      });
      setDirty(false);
      await onChanged();
      notify(r.archived ? "Resource restored." : "Resource archived.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget)),
      decision =
        (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
        "returned",
      checks = Object.fromEntries(
        Object.keys(criteria).map((key) => [
          key,
          String(values["check_" + key] || ""),
        ]),
      ),
      feedback = String(values.feedback || "").trim();
    setError("");
    if (
      Object.values(checks).some((value) => !["met", "revise"].includes(value))
    ) {
      setError("Complete each review checklist item.");
      return;
    }
    if (
      decision === "approved" &&
      Object.values(checks).some((value) => value !== "met")
    ) {
      setError("Resolve checklist items before approval.");
      return;
    }
    if (
      decision === "returned" &&
      (!feedback || !Object.values(checks).includes("revise"))
    ) {
      setError("Mark an item for revision and write revision feedback.");
      return;
    }
    if (
      decision === "approved" &&
      !(await confirm(
        "Approve this resource?",
        "This version will be available to approved school accounts in the Digital Bank.",
        "Approve resource",
      ))
    )
      return;
    setBusy(true);
    try {
      await backend.bank.decide({
        mid: id,
        expected_revision: detail.resource.revision,
        decision,
        feedback,
        checks,
      });
      setDirty(false);
      await onChanged();
      notify(
        decision === "approved"
          ? "Resource approved."
          : "Resource returned with feedback.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function revise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy) return;
    const changes = String(
      new FormData(event.currentTarget).get("changes") || "",
    ).trim();
    setError("");
    if (!revisionFile || !changes) {
      setError("Choose a file and describe the changes in this revision.");
      return;
    }
    setBusy(true);
    try {
      if (!receipt.current) {
        setProgress(0);
        receipt.current = await backend.bank.upload(
          id,
          revisionFile,
          setProgress,
        );
      }
      await backend.bank.revise({
        mid: id,
        expected_revision: detail.resource.revision,
        object_key: receipt.current,
        changes,
      });
      setDirty(false);
      setRevisionFile(null);
      receipt.current = null;
      setProgress(null);
      await onChanged();
      notify("Revision submitted for review.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveToggle() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await backend.bank.saved(id, !detail.resource.saved);
      setDetail({
        ...detail,
        resource: { ...detail.resource, saved: !detail.resource.saved },
      });
      notify(
        detail.resource.saved
          ? "Removed from saved resources."
          : "Resource saved.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        startIcon={<ArrowBack />}
        onClick={onBack}
        disabled={busy}
        sx={{ mb: 2 }}
      >
        Back to resources
      </Button>
      <ErrorNotice error={error} retry={() => setRetry((n) => n + 1)} />
      {loading ? (
        <Loading label="Loading resource…" />
      ) : (
        detail &&
        (() => {
          const r = detail.resource,
            state = resourceState(r),
            own = r.owner === person.id,
            head = person.role === "head",
            file = detail.versions[0],
            canReview =
              !!r.bank_category &&
              (detail.canReview ?? head) &&
              !own &&
              !r.contributors?.some((p) => p.id === person.id) &&
              ["pending", "resubmitted"].includes(state),
            canEdit =
              !(
                r.contributors?.length &&
                ["pending", "approved"].includes(state)
              ) &&
              !!r.bank_category &&
              !r.archived &&
              (head || (own && ["draft", "returned"].includes(state)));
          return (
            <>
              <Box
                component="header"
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  gap: 2,
                  p: { xs: 2, md: 2.5 },
                  mb: 2.5,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  sx={{
                    transform: "scale(1.35)",
                    transformOrigin: "top left",
                    mr: 1.5,
                    mb: 1.5,
                  }}
                >
                  <FileTile name={file?.name || r.filename} />
                </Box>
                <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    {categories[
                      (r.bank_category || r.category) as keyof typeof categories
                    ] ||
                      r.bank_category ||
                      r.category}
                  </Typography>
                  <Typography
                    variant="h1"
                    component="h2"
                    sx={{
                      fontSize: 24,
                      lineHeight: 1.25,
                      overflowWrap: "anywhere",
                      my: 0.5,
                      textWrap: "balance",
                    }}
                  >
                    {r.title}
                  </Typography>
                  <Box sx={{ ...row, gap: 1.25, color: "text.secondary" }}>
                    <Status resource={r} />
                    <Box sx={{ ...row, gap: 0.75 }}>
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "inline-grid",
                          placeItems: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          color: "background.paper",
                          bgcolor: "primary.main",
                        }}
                      >
                        {initials(r.creator || "?")}
                      </Box>
                      <Typography sx={{ fontSize: 13, color: "text.primary" }}>
                        {r.creator}
                        {r.contributors?.length
                          ? ` with ${r.contributors.map((p) => p.name).join(", ")}`
                          : ""}
                      </Typography>
                    </Box>
                    {[r.subject, r.grade, r.term].filter(Boolean).map((t) => (
                      <Box
                        key={t}
                        component="span"
                        sx={{
                          fontSize: 12,
                          px: 1,
                          py: 0.25,
                          bgcolor: "action.hover",
                          color: "text.primary",
                        }}
                      >
                        {t}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box
                  sx={{
                    ...row,
                    gap: 1,
                    ml: { sm: "auto" },
                    width: { xs: "100%", sm: "auto" },
                    flexDirection: { xs: "row-reverse", sm: "row" },
                    justifyContent: { xs: "flex-end", sm: "flex-start" },
                  }}
                >
                  <IconButton
                    aria-label="Refresh"
                    title="Refresh"
                    onClick={() => setRetry((n) => n + 1)}
                    disabled={busy}
                    sx={{ border: 1, borderColor: "divider" }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                  {head && !!r.bank_category && state !== "draft" && (
                    <Button
                      variant="outlined"
                      startIcon={
                        r.archived ? <RestoreOutlined /> : <ArchiveOutlined />
                      }
                      disabled={busy}
                      onClick={() => void archive()}
                    >
                      {r.archived ? "Restore" : "Archive"}
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outlined"
                      onClick={() => onEdit(r)}
                      disabled={busy}
                    >
                      Edit details
                    </Button>
                  )}
                  {!!r.bank_category && (
                    <Button
                      variant="outlined"
                      startIcon={
                        r.saved ? <Bookmark /> : <BookmarkBorderOutlined />
                      }
                      disabled={busy}
                      onClick={() => void saveToggle()}
                    >
                      {r.saved ? "Saved" : "Save"}
                    </Button>
                  )}
                  <ResourceActions
                    detail={detail}
                    person={person}
                    busy={busy}
                    notify={notify}
                    onHidden={(hidden) => setDetail({ ...detail, hidden })}
                  />
                  {file?.downloadUrl && !file.unavailable && (
                    <Button
                      component="a"
                      href={file.downloadUrl}
                      download={file.name}
                      startIcon={<DownloadOutlined />}
                      variant="contained"
                    >
                      Download
                    </Button>
                  )}
                </Box>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    lg: "minmax(0,1fr) 340px",
                  },
                  gap: 2.5,
                  alignItems: "start",
                }}
              >
                <Box sx={{ minWidth: 0, display: "grid", gap: 2.5 }}>
                  <ResourceExtras
                    detail={detail}
                    person={person}
                    notify={notify}
                    onChanged={() => setRetry((n) => n + 1)}
                  />
                  {(r.bank_description || r.bank_localization) && (
                    <Box
                      component="section"
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        bgcolor: "background.paper",
                      }}
                    >
                      <Typography
                        variant="h3"
                        component="h3"
                        sx={{
                          px: 2.5,
                          py: 1.5,
                          borderBottom: 1,
                          borderColor: "divider",
                        }}
                      >
                        About this resource
                      </Typography>
                      <Box sx={{ p: 2.5, display: "grid", gap: 2 }}>
                        {r.bank_description && (
                          <Typography
                            sx={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              fontSize: 14,
                              lineHeight: 1.6,
                              maxWidth: "70ch",
                            }}
                          >
                            {r.bank_description}
                          </Typography>
                        )}
                        {r.bank_localization && (
                          <Box
                            sx={(theme) => ({
                              p: 1.75,
                              borderLeft: 3,
                              borderColor: "primary.main",
                              bgcolor: `color-mix(in srgb, ${theme.palette.primary.main} 6%, transparent)`,
                            })}
                          >
                            <Typography
                              sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "text.secondary",
                                mb: 0.5,
                              }}
                            >
                              How it was localized
                            </Typography>
                            <Typography
                              sx={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {r.bank_localization.replace(
                                /^Contextualization \/ Localization:\s*/i,
                                "",
                              )}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                  {state !== "draft" && (
                    <Box
                      component="section"
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        bgcolor: "background.paper",
                      }}
                    >
                      <Typography
                        variant="h3"
                        component="h3"
                        sx={{
                          px: 2.5,
                          py: 1.5,
                          borderBottom: 1,
                          borderColor: "divider",
                        }}
                      >
                        Preview
                      </Typography>
                      <Box sx={{ p: 2.5 }}>
                        <Suspense
                          fallback={<Loading label="Loading preview…" />}
                        >
                          <FilePreview file={file} />
                        </Suspense>
                      </Box>
                    </Box>
                  )}
                  <Box component="section">
                    <Typography variant="h3" component="h3" sx={{ mb: 1.25 }}>
                      Version history
                    </Typography>
                    {!detail.versions.length && (
                      <Typography color="text.secondary">
                        No submitted versions.
                      </Typography>
                    )}
                    {detail.versions.map((version) => (
                      <Accordion
                        key={version.version}
                        disableGutters
                        variant="outlined"
                        sx={{
                          mb: 1,
                          "&:before": { display: "none" },
                          boxShadow: "none",
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography>
                            Version {version.version}
                            {r.final_version === version.version
                              ? " · Approved version"
                              : ""}{" "}
                            · {date(version.created)}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>
                            {version.changes}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="p"
                            gutterBottom
                          >
                            {version.uploader} · {version.name}
                          </Typography>
                          {version.bank_competency_text && (
                            <Typography sx={{ mb: 1, whiteSpace: "pre-wrap" }}>
                              Competency at submission:{" "}
                              {version.bank_competency_text}
                            </Typography>
                          )}
                          {detail.reviews
                            .filter(
                              (review) => review.version === version.version,
                            )
                            .map((review, index) => (
                              <Box key={index} sx={{ my: 1.5 }}>
                                <Typography sx={{ fontWeight: 500 }}>
                                  {review.decision === "approved"
                                    ? "Approved"
                                    : "Returned for revision"}{" "}
                                  · {review.reviewerName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {date(review.created)}
                                </Typography>
                                <Typography
                                  sx={{ whiteSpace: "pre-wrap", mt: 0.5 }}
                                >
                                  {review.feedback}
                                </Typography>
                              </Box>
                            ))}
                          {version.downloadUrl && !version.unavailable && (
                            <Link
                              href={version.downloadUrl}
                              download={version.name}
                            >
                              Download version {version.version}
                            </Link>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Box>
                  {!!detail.events.length && (
                    <Box component="section">
                      <Typography variant="h3" component="h3" sx={{ mb: 1.25 }}>
                        Activity
                      </Typography>
                      <Stack spacing={1.5}>
                        {detail.events.map((event, index) => (
                          <Box key={event.id || index}>
                            <Typography>{event.body}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {event.actorName} · {date(event.created)}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Box>
                <Box
                  component="aside"
                  sx={{
                    minWidth: 0,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    p: 2.5,
                    position: { lg: "sticky" },
                    top: { lg: 76 },
                  }}
                >
                  <Typography variant="h3" component="h3" sx={{ mb: 2 }}>
                    Details
                  </Typography>
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      display: "grid",
                      gridTemplateColumns: "minmax(85px,.8fr) minmax(0,1fr)",
                      gap: 1.25,
                      "& dt": { color: "text.secondary", fontSize: 12 },
                      "& dd": { m: 0, overflowWrap: "anywhere" },
                    }}
                  >
                    {[
                      [
                        "Category",
                        categories[
                          (r.bank_category ||
                            r.category) as keyof typeof categories
                        ] ||
                          r.bank_category ||
                          r.category,
                      ],
                      ["Learning area", r.subject],
                      ["Grade", r.grade],
                      ["Term", r.term],
                      ["Resource type", r.bank_resource_type],
                      ["Language", r.bank_language],
                      ["Usage rights", r.bank_rights],
                      ["Approved by", r.approverName],
                      ["Approved on", r.approved && date(r.approved)],
                      ["Updated", date(r.updated)],
                    ]
                      .filter(([, value]) => value)
                      .map(([key, value]) => (
                        <Box key={key} sx={{ display: "contents" }}>
                          <Typography component="dt">{key}</Typography>
                          <Typography component="dd">{value}</Typography>
                        </Box>
                      ))}
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography
                    sx={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                      mb: 0.75,
                    }}
                  >
                    Learning competency
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontWeight: 500,
                      p: 1.5,
                      bgcolor: "action.hover",
                    }}
                  >
                    {r.bank_competency || "—"}
                  </Typography>
                  {r.bank_competency_code && (
                    <Typography variant="caption">
                      Official code: {r.bank_competency_code}
                    </Typography>
                  )}
                  {r.bank_competency_source && (
                    <Typography variant="caption" component="p" sx={{ mt: 1 }}>
                      <Link
                        href={r.bank_competency_source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.bank_competency_source.title}, PDF page{" "}
                        {r.bank_competency_source.page}
                      </Link>{" "}
                      · {r.bank_curriculum_version}
                    </Typography>
                  )}
                  {!!r.bank_tags?.length && (
                    <>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "text.secondary",
                          mt: 2,
                          mb: 0.75,
                        }}
                      >
                        Tags
                      </Typography>
                      <Box
                        sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}
                      >
                        {r.bank_tags.map((t) => (
                          <Box
                            key={t}
                            component="span"
                            sx={{
                              fontSize: 12,
                              px: 1,
                              py: 0.25,
                              border: 1,
                              borderColor: "divider",
                            }}
                          >
                            {t}
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                  {r.bank_source && (
                    <>
                      <Typography
                        variant="h3"
                        component="h4"
                        sx={{ mt: 2, mb: 1 }}
                      >
                        Reference / Source
                      </Typography>
                      <Typography
                        sx={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {r.bank_source}
                      </Typography>
                    </>
                  )}
                  {r.bank_notes && (
                    <>
                      <Typography
                        variant="h3"
                        component="h4"
                        sx={{ mt: 2, mb: 1 }}
                      >
                        Additional notes
                      </Typography>
                      <Typography
                        sx={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {r.bank_notes}
                      </Typography>
                    </>
                  )}
                  {canReview && (
                    <Box
                      component="form"
                      onSubmit={review}
                      onChange={() => setDirty(true)}
                      sx={{ mt: 3 }}
                    >
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="h2" component="h3" gutterBottom>
                        Quality assurance
                      </Typography>
                      {!workflowReady ? (
                        <ErrorNotice error="Review checklist setup is required before recording a decision." />
                      ) : (
                        <Stack spacing={2}>
                          {Object.entries(criteria).map(([key, label]) => (
                            <TextField
                              select
                              label={label}
                              name={"check_" + key}
                              defaultValue=""
                              required
                              key={key}
                              disabled={busy}
                            >
                              <MenuItem value="">Select result</MenuItem>
                              <MenuItem value="met">
                                Meets requirements
                              </MenuItem>
                              <MenuItem value="revise">Needs revision</MenuItem>
                            </TextField>
                          ))}
                          <TextField
                            multiline
                            minRows={3}
                            label="Revision feedback"
                            name="feedback"
                            slotProps={{ htmlInput: { maxLength: 5000 } }}
                            disabled={busy}
                          />
                          <Button
                            type="submit"
                            value="returned"
                            variant="outlined"
                            disabled={busy}
                          >
                            Return for revision
                          </Button>
                          <Button
                            type="submit"
                            value="approved"
                            variant="contained"
                            disabled={busy}
                          >
                            Approve
                          </Button>
                          <RejectButton
                            detail={detail}
                            disabled={busy}
                            onDone={async () => {
                              setDirty(false);
                              await onChanged();
                              notify(
                                "Resource not accepted. The teacher was told why.",
                              );
                            }}
                          />
                        </Stack>
                      )}
                    </Box>
                  )}
                  {own && !!r.bank_category && state === "returned" && (
                    <Box
                      component="form"
                      onSubmit={revise}
                      onChange={() => setDirty(true)}
                      sx={{ mt: 3 }}
                    >
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="h2" component="h3" gutterBottom>
                        Upload revision
                      </Typography>
                      <Stack spacing={2}>
                        <Button
                          component="label"
                          variant="outlined"
                          startIcon={<UploadFileOutlined />}
                          disabled={busy}
                        >
                          Choose revision file
                          <input
                            hidden
                            type="file"
                            accept={fileAccept}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void backend
                                  .validateBankFile(file)
                                  .then(() => {
                                    setRevisionFile(file);
                                    receipt.current = null;
                                    setDirty(true);
                                  })
                                  .catch((e) => setError(message(e)));
                              e.target.value = "";
                            }}
                          />
                        </Button>
                        <Typography color="text.secondary" variant="caption">
                          {revisionFile?.name || fileHint}
                        </Typography>
                        <TextField
                          name="changes"
                          label="Changes in this version"
                          multiline
                          minRows={3}
                          required
                          disabled={busy}
                          slotProps={{ htmlInput: { maxLength: 3000 } }}
                        />
                        {progress !== null && busy && (
                          <Typography role="status">
                            {progress === 100
                              ? "Verifying file…"
                              : `Uploading · ${progress}%`}
                          </Typography>
                        )}
                        <Button
                          variant="contained"
                          type="submit"
                          disabled={busy}
                        >
                          Resubmit for review
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Box>
            </>
          );
        })()
      )}
    </>
  );
}
