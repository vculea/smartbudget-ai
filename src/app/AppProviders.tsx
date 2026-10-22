import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { useState, type ReactNode } from "react";
import { MonthProvider } from "./MonthContext";
import { createQueryClient } from "./queryClient";
import { theme } from "./theme";

interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={client}>
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={4000}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <MonthProvider>{children}</MonthProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
