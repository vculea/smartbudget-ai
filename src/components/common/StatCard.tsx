import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import { palette } from "../../app/theme";

export type StatTone = "indigo" | "green" | "red" | "violet";

const TONES: Record<StatTone, { fg: string; bg: string }> = {
  indigo: { fg: palette.indigo, bg: "rgba(79, 70, 229, 0.10)" },
  green: { fg: palette.green, bg: "rgba(5, 150, 105, 0.10)" },
  red: { fg: palette.red, bg: "rgba(225, 29, 72, 0.09)" },
  violet: { fg: palette.violet, bg: "rgba(124, 58, 237, 0.10)" },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatTone;
  caption?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "indigo",
  caption,
}: StatCardProps) {
  const colors = TONES[tone];
  return (
    <Card
      sx={{
        height: "100%",
        transition: "box-shadow .2s, transform .2s",
        "&:hover": {
          boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
          transform: "translateY(-1px)",
        },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {label}
            </Typography>
            <Typography
              component="p"
              variant="h5"
              sx={{
                mt: 0.75,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                wordBreak: "break-word",
              }}
            >
              {value}
            </Typography>
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {caption}
              </Typography>
            )}
          </Box>
          <Box
            aria-hidden
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              color: colors.fg,
              bgcolor: colors.bg,
            }}
          >
            <Icon size={22} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
