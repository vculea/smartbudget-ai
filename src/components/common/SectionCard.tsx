import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Elimină padding-ul conținutului (util pentru tabele). */
  flush?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  flush = false,
}: SectionCardProps) {
  return (
    <Card component="section" aria-label={title} sx={{ height: "100%" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
        sx={{ px: 3, pt: 2.5, pb: flush ? 2 : 0 }}
      >
        <Box>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <CardContent
        sx={
          flush ? { p: 0, "&:last-child": { pb: 0 } } : { px: 3, pt: 2, pb: 3 }
        }
      >
        {children}
      </CardContent>
    </Card>
  );
}
