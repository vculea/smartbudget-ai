import { Box, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
      <Box
        aria-hidden
        sx={{
          width: 56,
          height: 56,
          mx: "auto",
          mb: 2,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: "primary.main",
          bgcolor: "rgba(79, 70, 229, 0.08)",
        }}
      >
        <Icon size={26} />
      </Box>
      <Typography variant="subtitle1">{title}</Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, maxWidth: 380, mx: "auto" }}
        >
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}
