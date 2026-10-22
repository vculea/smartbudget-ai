import { createTheme } from "@mui/material/styles";
import { roRO } from "@mui/material/locale";

export const palette = {
  indigo: "#4f46e5",
  violet: "#7c3aed",
  green: "#059669",
  red: "#e11d48",
  amber: "#d97706",
  ink: "#0f172a",
  muted: "#64748b",
  border: "#e5e7ef",
  surface: "#ffffff",
  background: "#f5f6fb",
};

export const theme = createTheme(
  {
    cssVariables: false,
    palette: {
      mode: "light",
      primary: { main: palette.indigo, dark: "#4338ca", light: "#818cf8" },
      secondary: { main: palette.violet },
      success: { main: palette.green, light: "#d1fae5" },
      warning: { main: palette.amber, light: "#fef3c7" },
      error: { main: palette.red, light: "#ffe4e6" },
      background: { default: palette.background, paper: palette.surface },
      text: { primary: palette.ink, secondary: palette.muted },
      divider: palette.border,
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h4: { fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontWeight: 700, letterSpacing: "-0.01em" },
      h6: { fontWeight: 650, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: palette.background },
          "*:focus-visible": {
            outline: `2px solid ${palette.indigo}`,
            outlineOffset: 2,
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          },
        },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10, paddingInline: 18 } },
      },
      MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: palette.muted,
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            backgroundColor: "#fafbfe",
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 20 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  },
  roRO,
);
