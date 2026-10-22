import { Box } from "@mui/material";
import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { LoadingBlock } from "../common/LoadingBlock";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "absolute",
          left: -9999,
          "&:focus": {
            left: 16,
            top: 16,
            zIndex: 2000,
            bgcolor: "background.paper",
            p: 1.5,
            borderRadius: 2,
          },
        }}
      >
        Sari la conținut
      </Box>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Header onMenuClick={() => setMobileOpen(true)} />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            width: "100%",
            maxWidth: 1440,
            mx: "auto",
            outline: "none",
          }}
        >
          <Suspense fallback={<LoadingBlock rows={4} height={96} />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
