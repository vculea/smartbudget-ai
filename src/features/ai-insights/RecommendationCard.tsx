import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { CheckCircle2, Target } from "lucide-react";
import type { AiRecommendation, RecommendationPriority } from "../../types";
import { formatCurrency } from "../../utils/format";

const PRIORITY: Record<
  RecommendationPriority,
  { label: string; color: "error" | "warning" | "default" }
> = {
  HIGH: { label: "Prioritate ridicată", color: "error" },
  MEDIUM: { label: "Prioritate medie", color: "warning" },
  LOW: { label: "Prioritate scăzută", color: "default" },
};

interface RecommendationCardProps {
  recommendation: AiRecommendation;
  converted: boolean;
  onConvert: (recommendation: AiRecommendation) => void;
}

export function RecommendationCard({
  recommendation,
  converted,
  onConvert,
}: RecommendationCardProps) {
  const { label, color } = PRIORITY[recommendation.priority];
  const canConvert = recommendation.estimatedMonthlySavings > 0;

  return (
    <Card
      component="article"
      aria-label={recommendation.title}
      sx={{ height: "100%" }}
    >
      <CardContent
        sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Chip
          size="small"
          label={label}
          color={color}
          variant="outlined"
          sx={{ alignSelf: "flex-start", mb: 1.5 }}
        />
        <Typography component="h3" variant="subtitle1" sx={{ mb: 1 }}>
          {recommendation.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {recommendation.explanation}
        </Typography>

        <Box
          sx={{
            mt: "auto",
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: "rgba(5, 150, 105, 0.07)",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Economie lunară estimată
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              color: "success.main",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ~{formatCurrency(recommendation.estimatedMonthlySavings)} / lună
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Valoare orientativă; rezultatul real depinde de obiceiurile tale.
          </Typography>
        </Box>

        {canConvert && (
          <Stack sx={{ mt: 2 }}>
            <Button
              variant={converted ? "text" : "outlined"}
              startIcon={
                converted ? <CheckCircle2 size={18} /> : <Target size={18} />
              }
              disabled={converted}
              onClick={() => onConvert(recommendation)}
              aria-label={
                converted
                  ? undefined
                  : `Transformă în obiectiv: ${recommendation.title}`
              }
            >
              {converted ? "Obiectiv creat" : "Transformă în obiectiv"}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
