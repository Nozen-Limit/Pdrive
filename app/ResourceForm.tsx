import { useBusy } from "./operations";
import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, Close, UploadFileOutlined } from "@mui/icons-material";
import { backend, message } from "./api";
import { areas, categories, checkMetadata, grades, quarters } from "./domain";
import type {
  Competency,
  CurriculumConfig,
  Metadata,
  Person,
  Resource,
} from "./types";
import { ErrorNotice, Loading, formGrid, row, wide } from "./ui";
export function ResourceForm({
  person,
  editing,
  onBack,
  onSaved,
  setDirty,
}: {
  person: Person;
  editing: Resource | null;
  onBack: () => void;
  onSaved: (id: string) => void;
  setDirty: (dirty: boolean) => void;
}) {
  const [id] = useState(() => editing?.id || crypto.randomUUID()),
    [config, setConfig] = useState<CurriculumConfig | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useBusy(),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [file, setFile] = useState<File | null>(null),
    [subject, setSubject] = useState(
      areas.includes(editing?.subject || "") ? editing!.subject : "",
    ),
    [grade, setGrade] = useState(editing?.grade || ""),
    [term, setTerm] = useState(editing?.term || ""),
    [choice, setChoice] = useState<Competency | null>(null),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState<Competency[]>([]),
    [matches, setMatches] = useState(0),
    [searching, setSearching] = useState(false),
    [lookupError, setLookupError] = useState("");
  const receipt = useRef<string | null>(null),
    fileSequence = useRef(0);
  const metadataOnly = !!editing && !editing.bank_draft;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const value = await backend.bank.curriculum();
        const selected = editing?.bank_competency_id
          ? await backend.bank.competency(editing.bank_competency_id)
          : null;
        if (!cancelled) {
          setConfig(value);
          setChoice(selected?.status === "verified" ? selected : null);
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing?.id]);
  const mapped = !!config && (config.enforced || config.verified_count > 0);
  useEffect(() => {
    if (!mapped || !subject || !grade || !term) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setLookupError("");
    const timer = setTimeout(() => {
      void backend.bank
        .competencies(
          { subject, grade, term, q: search, status: "verified" },
          1,
        )
        .then((value) => {
          if (!cancelled) {
            setOptions(value.items);
            setMatches(value.total);
          }
        })
        .catch((e) => {
          if (!cancelled) setLookupError(message(e));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapped, subject, grade, term, search]);
  function changeScope(set: (value: string) => void, value: string) {
    set(value);
    setChoice(null);
    setSearch("");
    setDirty(true);
  }
  async function chooseFile(value: File | null) {
    if (busy) return;
    const sequence = ++fileSequence.current;
    if (value) {
      try {
        await backend.validateBankFile(value);
      } catch (e) {
        if (sequence === fileSequence.current) setError(message(e));
        return;
      }
    }
    if (sequence !== fileSequence.current) return;
    setError("");
    setFile(value);
    receipt.current = null;
    setDirty(true);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || !config) return;
    const action =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
      "submit";
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const fields: Metadata = {
      ...Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v).trim()]),
      ),
      subject,
      grade,
      term,
      tags: [
        ...new Set(
          String(values.tags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
    };
    setError("");
    try {
      if (mapped) {
        if (
          !choice ||
          choice.status !== "verified" ||
          choice.grade !== grade ||
          choice.learning_area !== subject ||
          (choice.quarter && choice.quarter !== term)
        )
          throw Error(
            "Choose a learning competency matching the grade, learning area and quarter.",
          );
        fields.competency_id = choice.id;
        fields.competency = choice.competency_text;
      }
      checkMetadata(fields);
      if (!metadataOnly && action === "submit" && !file)
        throw Error("Choose a PDF or DOCX file before submitting.");
      setBusy(true);
      if (metadataOnly) {
        await backend.bank.edit({
          mid: id,
          d: fields,
          expected_revision: editing!.revision,
        });
      } else {
        if (action === "submit" && file && !receipt.current) {
          setProgress(0);
          receipt.current = await backend.bank.upload(id, file, setProgress);
        }
        await backend.bank.save({
          mid: id,
          d: fields,
          expected_revision: editing?.revision || null,
          object_key: action === "submit" ? receipt.current : null,
          submit: action === "submit",
        });
      }
      setDirty(false);
      onSaved(id);
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  if (loading) return <Loading label="Preparing upload form…" />;
  if (!config)
    return (
      <ErrorNotice
        error={error || "The upload form could not load."}
        retry={() => location.reload()}
      />
    );
  const input = (
    name: string,
    label: string,
    value: string | undefined,
    max: number,
    multiline = false,
    required = true,
  ) => (
    <TextField
      key={name}
      name={name}
      label={label}
      defaultValue={value || ""}
      required={required}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      fullWidth
      slotProps={{ htmlInput: { maxLength: max } }}
      sx={multiline ? wide : undefined}
    />
  );
  const select = (
    name: string,
    label: string,
    value: string,
    options: string[],
    onChange?: (value: string) => void,
  ) => (
    <TextField
      select
      name={name}
      label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      required
      sx={{ width: "100%", maxWidth: name === "subject" ? undefined : 260 }}
    >
      <MenuItem value="">Choose {label.toLowerCase()}</MenuItem>
      {options.map((value) => (
        <MenuItem value={value} key={value}>
          {value}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <Box sx={{ maxWidth: 880 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={onBack}
        disabled={busy}
        sx={{ mb: 2 }}
      >
        Back to resources
      </Button>
      <Typography variant="h2" component="h2" sx={{ mb: 3 }}>
        {metadataOnly
          ? "Edit resource details"
          : editing
            ? "Edit draft"
            : "Upload resource"}
      </Typography>
      <Box
        component="form"
        onSubmit={save}
        onChange={() => setDirty(true)}
        aria-label="Resource upload"
      >
        <Box
          component="fieldset"
          disabled={busy}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <Box sx={formGrid}>
            {input("title", "Resource title", editing?.title, 200)}
            <TextField
              select
              name="category"
              label="Category"
              required
              defaultValue={editing?.bank_category || editing?.category || ""}
              sx={{ width: "100%", maxWidth: 260 }}
            >
              <MenuItem value="">Choose category</MenuItem>
              {Object.keys(categories).map((value) => (
                <MenuItem value={value} key={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            {select(
              "subject",
              "Learning area",
              subject,
              config.learning_areas?.length ? config.learning_areas : areas,
              (value) => changeScope(setSubject, value),
            )}
            {select("grade", "Grade level", grade, grades, (value) =>
              changeScope(setGrade, value),
            )}
            {select("term", "Quarter", term, quarters, (value) =>
              changeScope(setTerm, value),
            )}
            <TextField
              label="Creator"
              value={editing?.creator || person.name}
              slotProps={{ input: { readOnly: true } }}
            />
            {input(
              "description",
              "Description",
              editing?.bank_description,
              5000,
              true,
            )}
            {mapped ? (
              <Box sx={wide}>
                <Autocomplete
                  options={
                    choice && !options.some((row) => row.id === choice.id)
                      ? [choice, ...options]
                      : options
                  }
                  value={choice}
                  onChange={(_, value) => {
                    setChoice(value);
                    setDirty(true);
                  }}
                  onInputChange={(_, value, reason) => {
                    if (reason === "input") setSearch(value);
                  }}
                  getOptionLabel={(value) =>
                    (value.official_code ? value.official_code + " · " : "") +
                    value.competency_text
                  }
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  filterOptions={(options) => options}
                  loading={searching}
                  disabled={!subject || !grade || !term || busy}
                  noOptionsText="No matching competencies"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      label="Learning competency"
                      helperText={
                        !subject || !grade || !term
                          ? "Choose grade, learning area and quarter first."
                          : lookupError ||
                            `${matches} matches. Search by wording or official code.`
                      }
                      error={!!lookupError}
                    />
                  )}
                />
                {choice && (
                  <Box sx={{ mt: 1 }}>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                      {choice.competency_text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {choice.official_code
                        ? `Code: ${choice.official_code} · `
                        : ""}
                      {choice.curriculum_version} ·{" "}
                      <Link
                        href={choice.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {choice.source_title}, PDF page {choice.source_page}
                      </Link>
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              input(
                "competency",
                "Learning competency",
                editing?.bank_competency,
                3000,
                true,
              )
            )}
            {input(
              "localization",
              "Contextualization / Localization",
              editing?.bank_localization,
              5000,
              true,
            )}
            {input(
              "tags",
              "Keywords / Tags (comma separated)",
              editing?.bank_tags?.join(", "),
              1000,
            )}
            {input(
              "source",
              "Reference / Source (optional)",
              editing?.bank_source,
              2000,
              false,
              false,
            )}
            {input(
              "notes",
              "Additional notes (optional)",
              editing?.bank_notes,
              3000,
              true,
              false,
            )}
          </Box>
          {!metadataOnly && (
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length !== 1) {
                  setError("Choose one PDF or DOCX file.");
                  return;
                }
                void chooseFile(e.dataTransfer.files[0]);
              }}
              sx={{
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1,
                p: 2.5,
                my: 3,
                maxWidth: 560,
              }}
            >
              <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
                <Typography>Drag a file here, or choose a file.</Typography>
                <Button
                  component="label"
                  startIcon={<UploadFileOutlined />}
                  variant="outlined"
                  disabled={busy}
                >
                  Choose file
                  <input
                    hidden
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => {
                      void chooseFile(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                </Button>
                <Typography color="text.secondary" variant="caption">
                  PDF or DOCX · up to 20 MB
                </Typography>
                {file && (
                  <Box sx={row}>
                    <Typography sx={{ overflowWrap: "anywhere" }}>
                      {file.name} · {(file.size / 1048576).toFixed(2)} MB
                    </Typography>
                    <Button
                      startIcon={<Close />}
                      onClick={() => void chooseFile(null)}
                      disabled={busy}
                    >
                      Remove
                    </Button>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>
        {progress !== null && busy && (
          <Box role="status" sx={{ my: 2, maxWidth: 560 }}>
            <Typography variant="caption">
              {progress === 100
                ? "Verifying file…"
                : `Uploading file · ${progress}%`}
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}
        <ErrorNotice error={error} />
        <Box sx={{ ...row, mt: 3, justifyContent: "flex-start" }}>
          <Button onClick={onBack} disabled={busy}>
            Cancel
          </Button>
          {metadataOnly ? (
            <Button
              type="submit"
              value="metadata"
              variant="contained"
              disabled={busy}
            >
              Save changes
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                value="draft"
                variant="outlined"
                disabled={busy}
              >
                Save draft
              </Button>
              <Button
                type="submit"
                value="submit"
                variant="contained"
                disabled={busy}
              >
                {busy ? "Saving…" : "Submit for review"}
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
