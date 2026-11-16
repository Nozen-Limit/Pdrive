import { Fragment, useState } from "react";
import { FolderOutlined, ViewSidebarOutlined } from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Add,
  DashboardOutlined,
  FactCheckOutlined,
  HelpOutlineOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  MenuOutlined,
  NotificationsOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  PeopleOutlined,
  PersonOutlined,
  StickyNote2Outlined,
  StorageOutlined,
  GroupsOutlined,
} from "@mui/icons-material";
import type { ReactNode } from "react";
import type { Page, SchoolState, Scope } from "./types";
import { palettes, type PaletteName } from "./theme";
export function Workspace({
  state,
  page,
  scope,
  title,
  children,
  navigate,
  upload,
  logout,
  palette,
  onPalette,
  reviewCount,
}: {
  state: SchoolState;
  page: Page;
  scope: Scope;
  title: string;
  children: ReactNode;
  navigate: (page: Page, scope?: Scope) => void;
  upload: () => void;
  logout: () => void;
  palette: PaletteName;
  onPalette: (value: PaletteName) => void;
  /** Submissions waiting for this Head Teacher's review. */
  reviewCount: number;
}) {
  const theme = useTheme(),
    mobile = useMediaQuery(theme.breakpoints.down("md")),
    [open, setOpen] = useState(false),
    [account, setAccount] = useState<HTMLElement | null>(null),
    [slim, setSlim] = useState(() => {
      try {
        return localStorage.getItem("sikap-menu") === "slim";
      } catch {
        return false;
      }
    });
  const mini = slim && !mobile;
  const toggleSlim = () =>
    setSlim((value) => {
      try {
        localStorage.setItem("sikap-menu", value ? "full" : "slim");
      } catch {
        /* Remembering the menu width is optional. */
      }
      return !value;
    });
  const dark = palette !== "white";
  const head = state.user.role === "head",
    unread = state.notifications.filter((n) => !n.read).length;
  const items = [
    {
      page: "overview" as Page,
      label: "Overview",
      icon: <DashboardOutlined />,
    },
    {
      page: "bank" as Page,
      scope: "shared" as Scope,
      label: "Digital Bank",
      icon: <StorageOutlined />,
    },
    {
      page: "bank" as Page,
      scope: "mine" as Scope,
      label: "My Resources",
      icon: <FolderOutlined />,
    },
    {
      page: "collaboration" as Page,
      label: "Collaboration",
      icon: <GroupsOutlined />,
    },
    ...(head
      ? [
          {
            page: "bank" as Page,
            scope: "review" as Scope,
            label: "Review Queue",
            icon: (
              <Badge color="error" badgeContent={reviewCount}>
                <FactCheckOutlined />
              </Badge>
            ),
          },
        ]
      : []),
  ];
  const nav = (
    <Stack sx={{ height: "100%", p: 1.5, bgcolor: palettes[palette].side }}>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: "center",
          justifyContent: mini ? "center" : "flex-start",
          px: mini ? 0 : 1,
          pt: 0.5,
          pb: 3,
        }}
      >
        <Box
          sx={{
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "background.paper",
            flexShrink: 0,
          }}
        >
          <MenuBookOutlined sx={{ fontSize: 18 }} />
        </Box>
        {!mini && (
          <Typography
            sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em" }}
          >
            SIKAP
          </Typography>
        )}
      </Stack>
      <List dense sx={{ p: 0 }} aria-label="Workspace">
        {items.map((item) => (
          <Fragment key={item.label}>
            <ListItemButton
              key={item.label}
              title={mini ? item.label : undefined}
              aria-label={mini ? item.label : undefined}
              selected={
                page === item.page &&
                (page !== "bank" ||
                  item.scope === scope ||
                  (item.scope === "shared" &&
                    !["mine", "review"].includes(scope)))
              }
              onClick={() => {
                navigate(item.page, item.scope);
                setOpen(false);
              }}
              sx={{
                position: "relative",
                mb: 0.25,
                px: mini ? 0 : 1.25,
                py: 0.75,
                justifyContent: mini ? "center" : "flex-start",
                color: "text.secondary",
                "&.Mui-selected": {
                  bgcolor: "action.selected",
                  color: "text.primary",
                  fontWeight: 600,
                },
                "&.Mui-selected::before": {
                  content: '""',
                  position: "absolute",
                  left: -12,
                  top: 6,
                  bottom: 6,
                  width: 3,
                  bgcolor: "primary.main",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: mini ? 0 : 30,
                  color: "inherit",
                  "& svg": { fontSize: 18 },
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!mini && (
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: { xs: 12, md: 13 },
                        fontWeight: "inherit",
                      },
                    },
                  }}
                />
              )}
            </ListItemButton>
          </Fragment>
        ))}
      </List>
      <Box sx={{ flexGrow: 1, minHeight: 24 }} />
      <Divider sx={{ mb: 1 }} />
      <ListItemButton
        selected={page === "help"}
        onClick={() => {
          navigate("help");
          setOpen(false);
        }}
        title={mini ? "Help" : undefined}
        aria-label={mini ? "Help" : undefined}
        sx={{
          flexGrow: 0,
          px: mini ? 0 : 1.25,
          py: 0.75,
          justifyContent: mini ? "center" : "flex-start",
          color: "text.secondary",
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: mini ? 0 : 30,
            color: "inherit",
            "& svg": { fontSize: 18 },
          }}
        >
          <HelpOutlineOutlined />
        </ListItemIcon>
        {!mini && (
          <ListItemText
            primary="Help"
            slotProps={{ primary: { sx: { fontSize: { xs: 12, md: 13 } } } }}
          />
        )}
      </ListItemButton>
      <ListItemButton
        onClick={(e) => setAccount(e.currentTarget)}
        aria-label="Account menu"
        aria-haspopup="menu"
        sx={{
          flexGrow: 0,
          px: mini ? 0 : 1,
          py: 1,
          justifyContent: mini ? "center" : "flex-start",
        }}
      >
        <Avatar
          src={state.user.avatarUrl}
          alt={`${state.user.name} profile picture`}
          sx={{ width: 30, height: 30, fontSize: 12, mr: mini ? 0 : 1 }}
        >
          {state.user.name
            .split(/\s+/)
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </Avatar>
        <Box sx={{ minWidth: 0, display: mini ? "none" : "block" }}>
          <Typography
            sx={{ fontSize: 12, fontWeight: 600, overflowWrap: "anywhere" }}
          >
            {state.user.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {head ? "Head Teacher" : "Teacher"}
          </Typography>
        </Box>
      </ListItemButton>
      <Menu
        anchorEl={account}
        open={!!account}
        onClose={() => setAccount(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {(
          [
            ["profile", "Profile", <PersonOutlined fontSize="small" />],
            [
              "notes",
              "Personal Notes",
              <StickyNote2Outlined fontSize="small" />,
            ],
            ...(head
              ? [["teachers", "Teachers", <PeopleOutlined fontSize="small" />]]
              : []),
          ] as [Page, string, ReactNode][]
        ).map(([target, label, icon]) => (
          <MenuItem
            key={target}
            selected={page === target}
            onClick={() => {
              setAccount(null);
              setOpen(false);
              navigate(target);
            }}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            {label}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            setAccount(null);
            onPalette(dark ? "white" : "slate");
          }}
        >
          <ListItemIcon>
            {dark ? (
              <LightModeOutlined fontSize="small" />
            ) : (
              <DarkModeOutlined fontSize="small" />
            )}
          </ListItemIcon>
          {dark ? "Light mode" : "Dark mode"}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAccount(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </Stack>
  );
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
      <Drawer
        variant={mobile ? "temporary" : "permanent"}
        open={!mobile || open}
        onClose={() => setOpen(false)}
        sx={{
          width: mobile ? 0 : mini ? 64 : 232,
          flexShrink: 0,
          transition: "width .2s",
          "& .MuiDrawer-paper": {
            width: mobile ? 212 : mini ? 64 : 232,
            transition: "width .2s",
            overflowX: "hidden",
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {nav}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            bgcolor: "background.default",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar
            variant="dense"
            sx={{ minHeight: 60, gap: 1, px: { xs: 2, sm: 3 } }}
          >
            {mobile ? (
              <IconButton aria-label="Open menu" onClick={() => setOpen(true)}>
                <MenuOutlined />
              </IconButton>
            ) : (
              <IconButton
                aria-label={mini ? "Expand menu" : "Collapse menu"}
                title={mini ? "Expand menu" : "Collapse menu"}
                onClick={toggleSlim}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  width: 34,
                  height: 34,
                }}
              >
                <ViewSidebarOutlined fontSize="small" />
              </IconButton>
            )}
            {!mobile && page === "bank" ? (
              <Box
                id="desktop-bank-search"
                sx={{ flexGrow: 1, minWidth: 0, maxWidth: 520 }}
              />
            ) : (
              <Typography component="h1" variant="h3" sx={{ flexGrow: 1 }}>
                {title}
              </Typography>
            )}
            {!mobile && page === "bank" && <Box sx={{ flexGrow: 1 }} />}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={upload}
              sx={{ flexShrink: 0 }}
            >
              New resource
            </Button>
            <IconButton
              aria-label="Notifications"
              onClick={() => navigate("notifications")}
            >
              <Badge badgeContent={unread} color="error">
                <NotificationsOutlined fontSize="small" />
              </Badge>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box component="section" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          {!mobile && page === "bank" && (
            <Typography
              component="h1"
              sx={{ fontSize: 20, fontWeight: 600, mb: 2.5 }}
            >
              {title}
            </Typography>
          )}
          {children}
        </Box>
      </Box>
    </Box>
  );
}
