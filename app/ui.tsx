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
import { DescriptionOutlined } from "@mui/icons-material";
import type { ReactNode } from "react";
import type { Resource } from "./types";
import { resourceState, statusLabels, date } from "./domain";
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
  return (
    <Card
      sx={{ width: "100%", maxWidth: 340, minWidth: 0, alignSelf: "start" }}
    >
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1.5,
          }}
        >
          <DescriptionOutlined color="action" fontSize="small" />
          <Typography variant="caption" color="text.secondary" sx={{ pr: 3 }}>
            {resource.category || resource.bank_category} · v{resource.version}
          </Typography>
        </Stack>
        <Button
          variant="text"
          onClick={() => onOpen(resource.id)}
          sx={{
            p: 0,
            minHeight: 0,
            textAlign: "left",
            justifyContent: "flex-start",
            fontWeight: 500,
            lineHeight: 1.6,
            overflowWrap: "anywhere",
            whiteSpace: "normal",
          }}
        >
          {resource.title}
        </Button>
        <Box sx={{ ...row, mt: 1, mb: 1.25, gap: 0.5 }}>
          {[resource.subject, resource.grade, resource.term]
            .filter(Boolean)
            .map((value) => (
              <Chip
                key={value}
                label={value}
                sx={{ height: 21, fontSize: 10 }}
              />
            ))}
        </Box>
        <Typography
          color="text.secondary"
          variant="caption"
          component="p"
          sx={{ mb: 1 }}
        >
          {resource.creator} · {date(resource.updated)}
        </Typography>
        {showStatus && <Status resource={resource} />}
      </CardContent>
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
