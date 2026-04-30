"use client";

import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#22d3ee" },
    background: { default: "#000", paper: "#0a0f12" },
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace',
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
