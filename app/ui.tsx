import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import type { Resource } from "./types";
import { categories, resourceState, statusLabels } from "./domain";
export const row = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
} as const;
export const formGrid = {
  display: "grid",
  gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
  gap: 2,
  alignItems: "start",
} as const;
export const wide = { gridColumn: "1 / -1" };
export function ErrorNotice({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return error ? (
    <Alert
      severity="error"
      action={retry ? <Button onClick={retry}>Retry</Button> : undefined}
      sx={{ mb: 2, maxWidth: 850 }}
    >
      {error}
    </Alert>
  ) : null;
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      role="status"
      sx={{ alignItems: "center", py: 4 }}
    >
      <CircularProgress size={18} />
      <Typography color="text.secondary">{label}</Typography>
    </Stack>
  );
}
/** File-type colours, matched to how PDF, Word and PowerPoint mark their files. */
export const FILE_COLORS: Record<string, string> = {
  PDF: "#b6463a",
  DOCX: "#2f5d9e",
  PPTX: "#c1702a",
};
export function FileTile({ name }: { name?: string }) {
  const ext = (name?.split(".").pop() || "").toUpperCase();
  const label = ext === "DOC" ? "DOCX" : ext === "PPT" ? "PPTX" : ext;
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 32,
        height: 38,
        flexShrink: 0,
        display: "grid",
        alignItems: "end",
        justifyItems: "center",
        pb: 0.5,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: "#fff",
        bgcolor: FILE_COLORS[label] || "text.secondary",
        clipPath: "polygon(0 0, 72% 0, 100% 22%, 100% 100%, 0 100%)",
      }}
    >
      {label || "FILE"}
    </Box>
  );
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ py: 3, maxWidth: 480 }}>
      <Typography component="h2" variant="h3" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" component="div">
        {children}
      </Typography>
    </Box>
  );
}
export function Status({ resource }: { resource: Resource }) {
  const state = resourceState(resource);
  return (
    <Chip
      label={statusLabels[state] || state}
      color={
        state === "approved"
          ? "success"
          : state === "returned"
            ? "warning"
            : state === "rejected"
              ? "error"
              : "default"
      }
      sx={{ width: "fit-content" }}
    />
  );
}
export function ResourceCard({
  resource,
  onOpen,
  showStatus = true,
}: {
  resource: Resource;
  onOpen: (id: string) => void;
  showStatus?: boolean;
}) {
  const cat = resource.bank_category || resource.category || "";
  const blurb = resource.bank_competency || resource.bank_description;
  return (
    <Card
      sx={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        "&:hover": { borderColor: "text.secondary" },
      }}
    >
      <Box sx={{ display: "flex", gap: 1.5, p: 1.75, pb: 1, pr: 5 }}>
        <FileTile name={resource.filename} />
        <Box sx={{ minWidth: 0 }}>
          {cat && (
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              {categories[cat as keyof typeof categories] || cat}
            </Typography>
          )}
          <Button
            variant="text"
            onClick={() => onOpen(resource.id)}
            sx={{
              p: 0,
              minHeight: 0,
              textAlign: "left",
              justifyContent: "flex-start",
              fontWeight: 600,
              fontSize: 14,
              lineHeight: 1.35,
              color: "text.primary",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
          >
            {resource.title}
          </Button>
        </Box>
      </Box>
      <Typography
        color="text.secondary"
        sx={{
          px: 1.75,
          pb: 1.5,
          fontSize: 12,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {blurb ||
          [resource.subject, resource.grade].filter(Boolean).join(" · ")}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.75,
          py: 1.25,
          borderTop: 1,
          borderColor: "divider",
          fontSize: 12,
          minWidth: 0,
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "background.paper",
            bgcolor: "primary.main",
          }}
        >
          {initials(resource.creator || "?")}
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={resource.creator}
        >
          {resource.creator}
          {resource.contributors?.length
            ? ` +${resource.contributors.length}`
            : ""}
        </Typography>
        {showStatus ? (
          <Status resource={resource} />
        ) : (
          [resource.grade, resource.term].filter(Boolean).map((t) => (
            <Box
              key={t}
              component="span"
              sx={{
                fontSize: 11,
                px: 0.875,
                bgcolor: "action.hover",
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </Box>
          ))
        )}
      </Box>
    </Card>
  );
}
export interface Confirmation {
  title: string;
  body: string;
  action?: string;
  resolve: (answer: boolean) => void;
}
export function ConfirmDialog({
  value,
  onClose,
}: {
  value: Confirmation | null;
  onClose: (answer: boolean) => void;
}) {
  return (
    <Dialog
      maxWidth="xs"
      open={!!value}
      onClose={() => onClose(false)}
      aria-labelledby="confirmation-title"
    >
      <DialogTitle id="confirmation-title">{value?.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{value?.body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button variant="contained" onClick={() => onClose(true)}>
          {value?.action || "Continue"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export type Confirm = (
  title: string,
  body: string,
  action?: string,
) => Promise<boolean>;
