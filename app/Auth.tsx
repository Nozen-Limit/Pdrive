import { useBusy } from "./operations";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { api, backend, message } from "./api";
import { ErrorNotice } from "./ui";
export function Auth({
  onSignedIn,
  recovering,
}: {
  onSignedIn: () => Promise<void>;
  recovering: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [busy, setBusy] = useBusy(),
    [error, setError] = useState(backend.recoveryError || ""),
    [notice, setNotice] = useState(""),
    [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const recovery = recovering && !backend.recoveryError;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setNotice("");
    if (
      (mode === "register" || recovery) &&
      fields.password !== fields.confirm
    ) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (recovery) {
        await backend.updatePassword(String(fields.password));
        backend.clearRecovery();
        await onSignedIn();
        return;
      }
      if (mode === "reset") {
        await backend.reset(String(fields.email).trim());
        setNotice(
          "If this email has an account, a password reset email has been sent.",
        );
        return;
      }
      const result = await api<{ needsConfirmation?: boolean }>(
        "auth/" + mode,
        {
          name: fields.name,
          email: String(fields.email).trim(),
          password: fields.password,
          remember: fields.remember === "on",
        },
      );
      if (result.needsConfirmation) {
        setNotice("Email confirmation required.");
        setMode("login");
      } else await onSignedIn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box
      sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2 }}
    >
      <Paper
        variant="outlined"
        sx={{ width: "100%", maxWidth: 420, p: { xs: 2.5, sm: 4 } }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", mb: 3 }}
        >
          <MenuBookOutlined sx={{ fontSize: 30 }} />
          <Typography sx={{ fontWeight: 600 }}>PROJECT SIKAP</Typography>
        </Stack>
        <Typography variant="h1" component="h1" sx={{ mb: 3 }}>
          {recovery
            ? "Change password"
            : mode === "register"
              ? "Create account"
              : mode === "reset"
                ? "Reset password"
                : "Sign in"}
        </Typography>
        <Box
          component="form"
          onSubmit={submit}
          aria-label={recovery ? "Change password" : "School account"}
        >
          <Stack spacing={2}>
            {mode === "register" && !recovery && (
              <TextField
                label="Full name"
                name="name"
                required
                autoComplete="name"
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            )}
            {!recovery && (
              <TextField
                label="Email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                autoComplete="username"
              />
            )}
            {(mode !== "reset" || recovery) && (
              <TextField
                label={recovery ? "New password" : "Password"}
                name="password"
                type={visible ? "text" : "password"}
                required
                autoComplete={
                  recovery || mode === "register"
                    ? "new-password"
                    : "current-password"
                }
                slotProps={{
                  htmlInput: {
                    minLength: recovery || mode === "register" ? 12 : undefined,
                    maxLength: 200,
                  },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            visible ? "Hide password" : "Show password"
                          }
                          onClick={() => setVisible(!visible)}
                          edge="end"
                        >
                          {visible ? (
                            <VisibilityOffOutlined />
                          ) : (
                            <VisibilityOutlined />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
            {(recovery || mode === "register") && (
              <TextField
                label="Confirm password"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                slotProps={{ htmlInput: { minLength: 12, maxLength: 200 } }}
              />
            )}
            {!recovery && mode === "login" && (
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <FormControlLabel
                  control={<Checkbox name="remember" size="small" />}
                  label="Remember me"
                />
                <Button
                  onClick={() => {
                    setMode("reset");
                    setError("");
                    setNotice("");
                  }}
                >
                  Forgot password?
                </Button>
              </Stack>
            )}
            <ErrorNotice error={error} />
            {notice && <Alert severity="info">{notice}</Alert>}
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !!backend.recoveryError}
            >
              {busy
                ? "Please wait…"
                : recovery
                  ? "Save new password"
                  : mode === "reset"
                    ? "Send reset link"
                    : mode === "register"
                      ? "Create account"
                      : "Sign in"}
            </Button>
            {!recovery &&
              mode === "login" &&
              /confirm/i.test(error + notice) && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api("auth/resend", { email: email.trim() });
                      setNotice(
                        "If your account needs confirmation, a new link will arrive by email. Check Spam too.",
                      );
                    } catch (error) {
                      setError(message(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resend confirmation email
                </Button>
              )}
            <Button
              disabled={busy}
              onClick={() => {
                if (recovering) {
                  backend.clearRecovery();
                  void onSignedIn();
                }
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setNotice("");
              }}
            >
              {mode === "login" && !recovering
                ? "Create an account"
                : "Back to sign in"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
