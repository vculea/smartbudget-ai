import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { LineChart } from "lucide-react";
import { NavLink } from "react-router-dom";
import { palette } from "../../app/theme";
import { env } from "../../config/env";
import { NAV_ITEMS } from "./navigation";

export const SIDEBAR_WIDTH = 264;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2.5 }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1, mb: 4 }}
      >
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            background: `linear-gradient(135deg, ${palette.indigo}, ${palette.violet})`,
            boxShadow: "0 6px 16px rgba(79, 70, 229, 0.35)",
          }}
        >
          <LineChart size={22} />
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ lineHeight: 1.1, fontWeight: 800 }}
          >
            SmartBudget
          </Typography>
          <Typography
            variant="caption"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: "0.12em" }}
          >
            AI
          </Typography>
        </Box>
      </Box>

      <List
        component="nav"
        aria-label="Navigare principală"
        sx={{ display: "grid", gap: 0.5 }}
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            onClick={onNavigate}
            sx={{
              borderRadius: 2.5,
              py: 1.1,
              color: "text.secondary",
              "&.active": {
                color: "primary.main",
                bgcolor: "rgba(79, 70, 229, 0.09)",
                "& .MuiListItemText-primary": { fontWeight: 700 },
              },
              "&:hover": { bgcolor: "rgba(79, 70, 229, 0.06)" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>
              <Icon size={20} />
            </ListItemIcon>
            <ListItemText
              primary={label}
              slotProps={{ primary: { fontWeight: 500 } }}
            />
          </ListItemButton>
        ))}
      </List>

      <Box
        sx={{
          mt: "auto",
          p: 2,
          borderRadius: 3,
          bgcolor: "rgba(79, 70, 229, 0.06)",
        }}
      >
        <Typography variant="subtitle2">Finanțe sub control</Typography>
        <Typography variant="caption" color="text.secondary">
          {env.demoMode
            ? "Rulezi în mod demo, cu date salvate local în browser."
            : "Conectat la API-ul SmartBudget."}
        </Typography>
      </Box>
    </Box>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <Box
      component="aside"
      sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH },
        }}
      >
        <SidebarContent onNavigate={onClose} />
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: SIDEBAR_WIDTH,
            borderRight: `1px solid ${palette.border}`,
            bgcolor: "background.paper",
          },
        }}
      >
        <SidebarContent />
      </Drawer>
    </Box>
  );
}
