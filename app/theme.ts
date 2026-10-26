import { createTheme } from "@mui/material/styles";
export const palettes = {
  white: {
    name: "White",
    background: "#fafbfc",
    paper: "#ffffff",
    primary: "#34475f",
    text: "#202b38",
    muted: "#75808c",
    line: "#e4e7eb",
    side: "#f5f7f8",
  },
  slate: {
    name: "Slate",
    background: "#101720",
    paper: "#17212d",
    primary: "#b7c7df",
    text: "#edf1f7",
    muted: "#a2afc1",
    line: "#303d4c",
    side: "#131c27",
  },
  ocean: {
    name: "Ocean",
    background: "#0a1722",
    paper: "#122634",
    primary: "#a6cbdc",
    text: "#e6f1f7",
    muted: "#9bb6c7",
    line: "#294554",
    side: "#0e202d",
  },
  forest: {
    name: "Forest",
    background: "#111d19",
    paper: "#192a23",
    primary: "#b8cdbd",
    text: "#e8f2eb",
    muted: "#a0b6a8",
    line: "#324b3d",
    side: "#15231d",
  },
  warm: {
    name: "Warm",
    background: "#211c17",
    paper: "#2c251f",
    primary: "#d9c6ac",
    text: "#f3ece3",
    muted: "#c0b1a0",
    line: "#4d4135",
    side: "#272019",
  },
};
export type PaletteName = keyof typeof palettes;
export function makeTheme(name: PaletteName) {
  const p = palettes[name];
  return createTheme({
    palette: {
      mode: name === "white" ? "light" : "dark",
      primary: { main: p.primary },
      background: { default: p.background, paper: p.paper },
      text: { primary: p.text, secondary: p.muted },
      divider: p.line,
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: 'Inter,"Segoe UI",sans-serif',
      fontSize: 12,
      h1: { fontSize: 20, fontWeight: 600 },
      h2: { fontSize: 16, fontWeight: 600 },
      h3: { fontSize: 14, fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 500, fontSize: 12 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "@media (min-width:900px)": {
            body: { fontSize: 13 },
            ".MuiTableCell-root": { fontSize: 13 },
            ".MuiButton-root": { fontSize: 13 },
            ".MuiTab-root": { fontSize: 13 },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, size: "small" },
        styleOverrides: { root: { minHeight: 34, padding: "6px 12px" } },
      },
      MuiTextField: { defaultProps: { size: "small", variant: "outlined" } },
      MuiFormControl: { defaultProps: { size: "small" } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: { root: { height: "fit-content", boxShadow: "none" } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${p.line}`,
            fontSize: 12,
            padding: "12px 14px",
          },
          head: { color: p.muted, fontWeight: 500, whiteSpace: "nowrap" },
        },
      },
      MuiChip: {
        defaultProps: { size: "small", variant: "outlined" },
        styleOverrides: { root: { borderRadius: 4, fontSize: 11, height: 24 } },
      },
      MuiDialog: { defaultProps: { fullWidth: true, maxWidth: "sm" } },
      MuiStack: { defaultProps: { useFlexGap: true } },
      MuiOutlinedInput: { styleOverrides: { root: { fontSize: 13 } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontSize: 12,
            minHeight: 42,
            minWidth: 0,
            padding: "8px 12px",
          },
        },
      },
      MuiTabs: { styleOverrides: { root: { minHeight: 42 } } },
    },
  });
}
