import { Box, Skeleton, Stack } from "@mui/material";

interface LoadingBlockProps {
  rows?: number;
  height?: number;
}

/** Schelet generic de încărcare pentru liste și carduri. */
export function LoadingBlock({ rows = 4, height = 44 }: LoadingBlockProps) {
  return (
    <Stack spacing={1.5} role="status" aria-label="Se încarcă...">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={height} animation="wave" />
      ))}
      <Box
        component="span"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Se încarcă...
      </Box>
    </Stack>
  );
}
