import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { message } from "./api";

// Shown once to accounts created before the Privacy Notice existed, and again
// whenever the notice's version changes (RA 10173 consent).
const noticeUrl = import.meta.env.BASE_URL + "privacy.html";

export function PrivacyGate({
  email,
  onAgree,
  onLogout,
}: {
  email: string;
  onAgree: () => Promise<void>;
  onLogout: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function agree() {
    setBusy(true);
    setError("");
    try {
      await onAgree();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2 }}
    >
      <Paper variant="outlined" sx={{ p: 3, maxWidth: 520, width: "100%" }}>
        <Typography variant="h1" gutterBottom>
          Privacy Notice
        </Typography>
        <Typography color="text.secondary">{email}</Typography>
        <Typography sx={{ mt: 2 }}>
          Before you continue, please read how Project SIKAP uses your
          information. The site keeps your name, email, profile details and the
          resources you work on, so the school can approve your account, credit
          your work and review submissions.
        </Typography>
        <Typography sx={{ mt: 2 }}>
          <Link href={noticeUrl} target="_blank" rel="noopener">
            Read the full Privacy Notice
          </Link>
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button onClick={onLogout} disabled={busy}>
            Log out
          </Button>
          <Button
            variant="contained"
            onClick={() => void agree()}
            disabled={busy}
          >
            {busy ? "Saving…" : "I agree"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
