import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
  Component,
  type ReactNode,
} from "react";
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Paper,
  Snackbar,
  Stack,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { api, backend, message } from "./api";
import type { Page, Resource, SchoolState, Scope } from "./types";
import { makeTheme, palettes, type PaletteName } from "./theme";
import { Operations } from "./operations";
import { Auth } from "./Auth";
import { Workspace } from "./Workspace";
const Collaboration = lazy(() => import("./Collaboration"));
const Library = lazy(() =>
  import("./Library").then((module) => ({ default: module.Library })),
);
import { Overview, Summary, readOverview } from "./Overview";
const ResourceForm = lazy(() =>
  import("./ResourceForm").then((module) => ({ default: module.ResourceForm })),
);
const ResourceDetail = lazy(() =>
  import("./ResourceDetail").then((module) => ({
    default: module.ResourceDetail,
  })),
);
import { Notes, Notifications, Profile, Teachers } from "./AccountPages";
import { ConfirmDialog, ErrorNotice, Loading, type Confirmation } from "./ui";
const scopeNames: Scope[] = [
  "shared",
  "mine",
  "saved",
  "recent",
  "review",
  "all",
  "archived",
];
function initialRoute(): { page: Page; scope: Scope; resource: string } {
  try {
    const hash = location.hash.slice(1),
      params = new URLSearchParams(
        hash.startsWith("bank=") ? decodeURIComponent(hash.slice(5)) : hash,
      ),
      scope = params.get("scope") as Scope;
    const resource = params.get("resource") || "";
    if (resource && !/^[a-f0-9-]{36}$/i.test(resource))
      return { page: "bank", scope: "shared", resource: "" };
    const requested =
      params.get("page") ||
      (hash.startsWith("bank=") || resource ? "bank" : "overview");
    const pages: Page[] = [
      "overview",
      "bank",
      "notes",
      "notifications",
      "teachers",
      "profile",
      "summary",
      "collaboration",
    ];
    return {
      page: resource
        ? "detail"
        : pages.includes(requested as Page)
          ? (requested as Page)
          : "overview",
      scope: scopeNames.includes(scope) ? scope : "shared",
      resource,
    };
  } catch {
    return { page: "overview", scope: "shared", resource: "" };
  }
}
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Box sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="h2" gutterBottom>
          The page could not be displayed.
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Reload to reopen your workspace. Saved resources are preserved.
        </Typography>
        <Button onClick={() => location.reload()} variant="contained">
          Reload website
        </Button>
      </Box>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const [state, setState] = useState<SchoolState | null>(null),
    [loading, setLoading] = useState(true),
    [initialError, setInitialError] = useState(""),
    [recovering, setRecovering] = useState(
      backend.recovery || !!backend.recoveryError,
    ),
    [route, setRoute] = useState(initialRoute),
    [categoryRequest, setCategoryRequest] = useState({ value: "", key: 0 }),
    [editing, setEditing] = useState<Resource | null>(null),
    [dirty, setDirty] = useState(false),
    [epoch, setEpoch] = useState(0),
    [toast, setToast] = useState(""),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [rows, setRows] = useState<Resource[]>([]),
    [rowsLoading, setRowsLoading] = useState(true),
    [rowsError, setRowsError] = useState(""),
    [palette, setPalette] = useState<PaletteName>(() => {
      try {
        const saved = localStorage.getItem("sikap-appearance");
        return saved && Object.hasOwn(palettes, saved)
          ? (saved as PaletteName)
          : "white";
      } catch {
        return "white";
      }
    });
  const sessionSequence = useRef(0),
    work = useRef(new Set<string>()),
    confirmRef = useRef<Confirmation | null>(null),
    mounted = useRef(true);
  const lock = useCallback((key: string, value: boolean) => {
    if (value) work.current.add(key);
    else work.current.delete(key);
  }, []);
  const theme = useMemo(() => makeTheme(palette), [palette]);
  const notify = useCallback((text: string) => setToast(text), []);
  const confirm = useCallback(
    (title: string, body: string, action?: string) =>
      new Promise<boolean>((resolve) => {
        confirmRef.current?.resolve(false);
        const value = { title, body, action, resolve };
        confirmRef.current = value;
        setConfirmation(value);
      }),
    [],
  );
  const answer = (value: boolean) => {
    confirmRef.current?.resolve(value);
    confirmRef.current = null;
    setConfirmation(null);
  };
  const loadSession = useCallback(async () => {
    const sequence = ++sessionSequence.current;
    setInitialError("");
    try {
      await backend.ready();
      if (sequence !== sessionSequence.current) return;
      const recovery = backend.recovery || !!backend.recoveryError;
      setRecovering(recovery);
      if (recovery) {
        setState(null);
        return;
      }
      const value = await api<SchoolState>("state");
      if (sequence === sessionSequence.current) {
        setState(value);
        setEpoch((n) => n + 1);
      }
    } catch (e) {
      if (sequence !== sessionSequence.current) return;
      if (backend.recovery || backend.recoveryError) {
        setRecovering(true);
        setState(null);
      } else if ((e as { status?: number }).status === 401) setState(null);
      else setInitialError(message(e));
    } finally {
      if (sequence === sessionSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void loadSession();
    const recovery = () => {
      setRecovering(true);
      setState(null);
    };
    window.addEventListener("sikap:password-recovery", recovery);
    return () => {
      mounted.current = false;
      sessionSequence.current++;
      window.removeEventListener("sikap:password-recovery", recovery);
      confirmRef.current?.resolve(false);
    };
  }, [loadSession]);
  const approved = state?.user.approval_status === "approved";
  useEffect(() => {
    if (!state || !approved) return;
    let cancelled = false;
    setRowsLoading(true);
    setRowsError("");
    void readOverview(state.user.role === "head")
      .then((value) => {
        if (!cancelled) setRows(value);
      })
      .catch((e) => {
        if (!cancelled) setRowsError(message(e));
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state?.user.id, state?.user.role, approved, epoch]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty || work.current.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  async function refresh() {
    const account = state?.user.id,
      sequence = sessionSequence.current;
    try {
      const value = await api<SchoolState>("state");
      if (
        mounted.current &&
        sequence === sessionSequence.current &&
        value.user.id === account
      )
        setState(value);
    } catch (e) {
      if (mounted.current && sequence === sessionSequence.current)
        notify("The page could not refresh. " + message(e));
    } finally {
      if (mounted.current && sequence === sessionSequence.current)
        setEpoch((n) => n + 1);
    }
  }
  async function navigate(
    page: Page,
    scope = route.scope,
    resource = "",
    force = false,
    edit: Resource | null = null,
  ) {
    if (!force && work.current.size) {
      notify("Please wait for the current action to finish.");
      return false;
    }
    if (
      !force &&
      dirty &&
      !(await confirm(
        "Discard changes?",
        "Your unsaved changes will be lost.",
        "Discard changes",
      ))
    )
      return false;
    if (
      state?.user.role !== "head" &&
      (["teachers", "summary"].includes(page) ||
        (page === "bank" && ["review", "archived", "all"].includes(scope)))
    ) {
      page = "overview";
      scope = "shared";
    }
    setDirty(false);
    setEditing(edit);
    setRoute({ page, scope, resource });
    const query = new URLSearchParams({ page, scope });
    if (resource) query.set("resource", resource);
    history.replaceState(null, "", "#" + query.toString());
    window.scrollTo(0, 0);
    return true;
  }
  const open = (id: string) => {
    void navigate("detail", route.scope, id);
  };
  async function editResource(resource: Resource) {
    if (work.current.size) return;
    try {
      const value = await backend.bank.details(resource.id);
      await navigate("upload", route.scope, "", false, value.resource);
    } catch (e) {
      notify(message(e));
    }
  }
  async function logout() {
    if (work.current.size) {
      notify("Please wait for the current action to finish.");
      return;
    }
    if (
      dirty &&
      !(await confirm(
        "Discard changes and log out?",
        "Your unsaved changes will be lost.",
        "Log out",
      ))
    )
      return;
    try {
      sessionSequence.current++;
      await api("auth/logout", {});
      setState(null);
      setRows([]);
      setDirty(false);
      setRoute({ page: "overview", scope: "shared", resource: "" });
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) {
      notify(message(e));
    }
  }
  function saved(id: string) {
    setDirty(false);
    void navigate("detail", "mine", id, true);
    void refresh();
    notify(
      editing && !editing.bank_draft
        ? "Resource details updated."
        : "Resource saved.",
    );
  }
  const page = route.page,
    head = state?.user.role === "head";
  let content: ReactNode;
  if (loading)
    content = (
      <Box sx={{ p: 3 }}>
        <Loading label="Loading your workspace…" />
      </Box>
    );
  else if (!state || recovering)
    content = (
      <>
        <Auth onSignedIn={loadSession} recovering={recovering} />
        {initialError && (
          <Box sx={{ position: "fixed", bottom: 16, left: 16, right: 16 }}>
            <ErrorNotice
              error={initialError}
              retry={() => void loadSession()}
            />
          </Box>
        )}
      </>
    );
  else if (!approved)
    content = (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          p: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: 3, maxWidth: 480, width: "100%" }}>
          <Typography variant="h1" gutterBottom>
            {state.user.approval_status === "rejected"
              ? "Request not approved"
              : state.user.approval_status
                ? "Awaiting approval"
                : "Account setup required"}
          </Typography>
          <Typography sx={{ my: 2 }}>{state.user.email}</Typography>
          <Typography color="text.secondary">
            {state.user.approval_status === "rejected"
              ? "Contact your school for assistance."
              : "A head teacher must approve your account before you can access school resources."}
          </Typography>
          {state.user.approval_note && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {state.user.approval_note}
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button onClick={() => void logout()}>Log out</Button>
            <Button variant="contained" onClick={() => void loadSession()}>
              Check status
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  else {
    let body: ReactNode;
    const common = { state, onChanged: refresh, notify, confirm, setDirty };
    if (page === "bank")
      body = (
        <Library
          categoryRequest={categoryRequest}
          scope={route.scope}
          head={head}
          userId={state.user.id}
          onScope={(scope) => void navigate("bank", scope)}
          onOpen={open}
          onEdit={(r) => void editResource(r)}
          onUpload={() => void navigate("upload")}
          epoch={epoch}
          onChanged={refresh}
          confirm={confirm}
          notify={notify}
        />
      );
    else if (page === "collaboration")
      body = (
        <Collaboration
          person={state.user}
          onOpen={open}
          onUpload={() => void navigate("upload")}
          notify={notify}
          confirm={confirm}
          setDirty={setDirty}
          onChanged={refresh}
        />
      );
    else if (page === "upload")
      body = (
        <ResourceForm
          key={editing?.id || "new"}
          person={state.user}
          editing={editing}
          onBack={() => void navigate("bank", "mine")}
          onSaved={saved}
          setDirty={setDirty}
        />
      );
    else if (page === "detail" && route.resource)
      body = (
        <ResourceDetail
          key={route.resource}
          id={route.resource}
          person={state.user}
          workflowReady={state.workflowReady}
          epoch={epoch}
          onBack={() => void navigate("bank", route.scope)}
          onEdit={(r) => void editResource(r)}
          onChanged={refresh}
          confirm={confirm}
          notify={notify}
          setDirty={setDirty}
        />
      );
    else if (page === "notes") body = <Notes {...common} />;
    else if (page === "notifications")
      body = (
        <Notifications
          state={state}
          onChanged={refresh}
          onOpen={open}
          onCollaboration={() => void navigate("collaboration")}
        />
      );
    else if (page === "teachers" && head) body = <Teachers {...common} />;
    else if (page === "profile")
      body = (
        <Profile
          key={state.user.id}
          {...common}
          onPerson={(value) =>
            setState((old) =>
              old ? { ...old, user: { ...old.user, ...value } } : old,
            )
          }
        />
      );
    else if (page === "summary" && head)
      body = (
        <>
          <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
            <Button onClick={() => void navigate("overview")}>
              Back to Overview
            </Button>
            <Button onClick={() => void refresh()}>Refresh summary</Button>
          </Box>
          {rowsLoading ? (
            <Loading />
          ) : rowsError ? (
            <ErrorNotice
              error={rowsError}
              retry={() => setEpoch((n) => n + 1)}
            />
          ) : (
            <Summary rows={rows} state={state} epoch={epoch} />
          )}
        </>
      );
    else
      body = (
        <Overview
          rows={rows}
          state={state}
          loading={rowsLoading}
          error={rowsError}
          retry={() => setEpoch((n) => n + 1)}
          onOpen={open}
          onSummary={() => void navigate("summary")}
          onBank={() => void navigate("bank", head ? "all" : "mine")}
          onNotes={() => void navigate("notes")}
        />
      );
    const titles: Record<Page, string> = {
      overview: "Overview",
      bank:
        route.scope === "mine"
          ? "My Resources"
          : route.scope === "review"
            ? "Review Queue"
            : route.scope === "archived"
              ? "Archived Resources"
              : route.scope === "saved"
                ? "Saved Resources"
                : "Digital Bank",
      upload: editing ? "Edit resource" : "Upload resource",
      detail: "Resource details",
      notes: "Personal Notes",
      notifications: "Notifications",
      teachers: "Teachers",
      profile: "Profile",
      summary: "Teacher summary",
      collaboration: "Collaboration",
    };
    content = (
      <Workspace
        state={state}
        page={page}
        scope={route.scope}
        title={titles[page]}
        navigate={(page, scope) => void navigate(page, scope)}
        onCategory={(value) => {
          void navigate("bank", "shared").then((changed) => {
            if (changed)
              setCategoryRequest((old) => ({ value, key: old.key + 1 }));
          });
        }}
        upload={() => void navigate("upload")}
        logout={() => void logout()}
        palette={palette}
        onPalette={(value) => {
          setPalette(value);
          try {
            localStorage.setItem("sikap-appearance", value);
          } catch {
            /* Theme persistence is optional. */
          }
        }}
      >
        <Suspense fallback={<Loading label="Loading page…" />}>{body}</Suspense>
      </Workspace>
    );
  }
  return (
    <Operations.Provider value={lock}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Boundary>{content}</Boundary>
        <ConfirmDialog value={confirmation} onClose={answer} />
        <Snackbar
          open={!!toast}
          message={toast}
          autoHideDuration={5000}
          onClose={() => setToast("")}
        />
      </ThemeProvider>
    </Operations.Provider>
  );
}
