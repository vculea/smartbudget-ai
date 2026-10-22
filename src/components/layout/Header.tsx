import {
  AppBar,
  Avatar,
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  Menu as UserMenuPopup,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, LogOut, Menu, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "../../app/useToast";
import { useAuth } from "../../auth/AuthContext";
import { env } from "../../config/env";
import { resetDemoData } from "../../mocks/db";
import { NAV_ITEMS } from "./navigation";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const title =
    NAV_ITEMS.find((item) => pathname.startsWith(item.to))?.label ??
    "SmartBudget AI";

  const handleReset = async () => {
    resetDemoData();
    await queryClient.invalidateQueries();
    toast.success("Datele demo au fost resetate.");
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: "rgba(245, 246, 251, 0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 1.5, px: { xs: 2, md: 4 } }}>
        <IconButton
          edge="start"
          aria-label="Deschide meniul"
          onClick={onMenuClick}
          sx={{ display: { md: "none" } }}
        >
          <Menu size={22} />
        </IconButton>
        <Typography component="p" variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {env.demoMode && (
          <>
            <Chip
              icon={<FlaskConical size={14} />}
              label="Mod demo"
              size="small"
              color="secondary"
              variant="outlined"
            />
            <Tooltip title="Resetează datele demo">
              <IconButton
                aria-label="Resetează datele demo"
                size="small"
                onClick={handleReset}
              >
                <RotateCcw size={18} />
              </IconButton>
            </Tooltip>
          </>
        )}
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!user) return null;

  const label = user.name || user.email;
  const initials = label
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label="Meniul contului"
          aria-haspopup="menu"
          aria-expanded={anchor ? true : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{ p: 0.5 }}
        >
          <Avatar
            src={user.pictureUrl ?? undefined}
            alt={label}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{
              width: 36,
              height: 36,
              bgcolor: "primary.main",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
        </IconButton>
      </Tooltip>
      <UserMenuPopup
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1, maxWidth: 260 }}>
          {user.name && (
            <Typography variant="subtitle2" noWrap>
              {user.name}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" noWrap>
            {user.email}
          </Typography>
        </Box>
        {!env.demoMode && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              logout();
            }}
          >
            <ListItemIcon>
              <LogOut size={18} />
            </ListItemIcon>
            Deconectare
          </MenuItem>
        )}
      </UserMenuPopup>
    </>
  );
}
