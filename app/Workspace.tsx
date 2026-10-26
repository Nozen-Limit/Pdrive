import { useState } from "react";
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
  ArchiveOutlined,
  DashboardOutlined,
  FactCheckOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  MenuOutlined,
  NotificationsOutlined,
  PaletteOutlined,
  PeopleOutlined,
  StickyNote2Outlined,
  StorageOutlined,
  BookmarkBorderOutlined,
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
}) {
  const theme = useTheme(),
    mobile = useMediaQuery(theme.breakpoints.down("md")),
    [open, setOpen] = useState(false),
    [anchor, setAnchor] = useState<HTMLElement | null>(null);
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
      icon: <FolderOpenOutlined />,
    },
    {
      page: "bank" as Page,
      scope: "saved" as Scope,
      label: "Saved Resources",
      icon: <BookmarkBorderOutlined />,
    },
    ...(head
      ? [
          {
            page: "bank" as Page,
            scope: "review" as Scope,
            label: "Review Queue",
            icon: <FactCheckOutlined />,
          },
          {
            page: "bank" as Page,
            scope: "archived" as Scope,
            label: "Archived Resources",
            icon: <ArchiveOutlined />,
          },
        ]
      : []),
    {
      page: "notes" as Page,
      label: "Personal Notes",
      icon: <StickyNote2Outlined />,
    },
    ...(head
      ? [
          {
            page: "teachers" as Page,
            label: "Teachers",
            icon: <PeopleOutlined />,
          },
        ]
      : []),
    {
      page: "notifications" as Page,
      label: "Notifications",
      icon: (
        <Badge color="error" badgeContent={unread}>
          <NotificationsOutlined />
        </Badge>
      ),
    },
  ];
  const nav = (
    <Stack sx={{ height: "100%", p: 1.5, bgcolor: palettes[palette].side }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", px: 1, pt: 0.5, pb: 3 }}
      >
        <MenuBookOutlined sx={{ fontSize: 28 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
          PROJECT SIKAP
        </Typography>
      </Stack>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<Add />}
        onClick={() => {
          upload();
          setOpen(false);
        }}
        sx={{ alignSelf: "flex-start", mb: 2, ml: 1 }}
      >
        New resource
      </Button>
      <List dense sx={{ p: 0 }} aria-label="Workspace">
        {items.map((item) => (
          <ListItemButton
            key={item.label}
            selected={
              page === item.page && (page !== "bank" || scope === item.scope)
            }
            onClick={() => {
              navigate(item.page, item.scope);
              setOpen(false);
            }}
            sx={{
              borderRadius: 1,
              mb: 0.25,
              px: 1.25,
              py: 0.6,
              "&.Mui-selected": { bgcolor: "action.selected" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 30, "& svg": { fontSize: 18 } }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontSize: 12 } } }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1, minHeight: 24 }} />
      <Divider sx={{ mb: 1 }} />
      <ListItemButton
        onClick={() => {
          navigate("profile");
          setOpen(false);
        }}
        aria-label="Open profile"
        sx={{ borderRadius: 1, px: 1, py: 1 }}
      >
        <Avatar
          src={state.user.avatarUrl}
          alt={`${state.user.name} profile picture`}
          sx={{ width: 30, height: 30, fontSize: 12, mr: 1 }}
        >
          {state.user.name
            .split(/\s+/)
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, overflowWrap: "anywhere" }}>
            {state.user.name}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 10 }}>
            {head ? "Head Teacher" : "Teacher"}
          </Typography>
        </Box>
      </ListItemButton>
      <Button
        color="inherit"
        onClick={logout}
        startIcon={<LogoutOutlined sx={{ fontSize: 17 }} />}
        sx={{ justifyContent: "flex-start", color: "text.secondary" }}
      >
        Log out
      </Button>
    </Stack>
  );
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
      <Drawer
        variant={mobile ? "temporary" : "permanent"}
        open={!mobile || open}
        onClose={() => setOpen(false)}
        sx={{
          width: mobile ? 0 : 212,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 212,
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
            {mobile && (
              <IconButton aria-label="Open menu" onClick={() => setOpen(true)}>
                <MenuOutlined />
              </IconButton>
            )}
            <Typography component="h1" variant="h3" sx={{ flexGrow: 1 }}>
              {title}
            </Typography>
            <IconButton
              aria-label="Choose color"
              onClick={(e) => setAnchor(e.currentTarget)}
            >
              <PaletteOutlined fontSize="small" />
            </IconButton>
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
          {children}
        </Box>
      </Box>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {(Object.keys(palettes) as PaletteName[]).map((name) => (
          <MenuItem
            key={name}
            selected={palette === name}
            onClick={() => {
              onPalette(name);
              setAnchor(null);
            }}
          >
            {palettes[name].name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
