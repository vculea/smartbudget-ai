import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useSelectedMonth } from "../../app/MonthContext";
import { palette } from "../../app/theme";
import { getErrorMessage } from "../../api";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { MonthSelector } from "../../components/common/MonthSelector";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import type { AiRecommendation } from "../../types";
import { addMonthsToDate, formatMonthLabel, todayIso } from "../../utils/date";
import {
  GoalFormDialog,
  type GoalFormInitialValues,
} from "../goals/GoalFormDialog";
import { useAiAnalysis } from "./hooks";
import { RecommendationCard } from "./RecommendationCard";

const GOAL_HORIZON_MONTHS = 6;

function toGoalDraft(recommendation: AiRecommendation): GoalFormInitialValues {
  return {
    name: `Economii: ${recommendation.title}`.slice(0, 120),
    targetAmount: Math.round(
      recommendation.estimatedMonthlySavings * GOAL_HORIZON_MONTHS,
    ),
    targetDate: addMonthsToDate(todayIso(), GOAL_HORIZON_MONTHS),
  };
}

export function AiInsightsPage() {
  const { month } = useSelectedMonth();
  const analysis = useAiAnalysis();
  const [draft, setDraft] = useState<{
    id: string;
    values: GoalFormInitialValues;
  } | null>(null);
  const [convertedIds, setConvertedIds] = useState<string[]>([]);

  const runAnalysis = () => {
    setConvertedIds([]);
    analysis.mutate({ month });
  };

  const result = analysis.data;

  return (
    <>
      <PageHeader
        title="AI Financial Coach"
        subtitle="Recomandări personalizate, generate pe baza tranzacțiilor tale."
        actions={<MonthSelector />}
      />

      <Card
        sx={{
          mb: 3,
          color: "#fff",
          border: "none",
          background: `linear-gradient(135deg, ${palette.indigo} 0%, ${palette.violet} 100%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <Box sx={{ maxWidth: 640 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Sparkles size={20} aria-hidden />
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: "0.1em", fontWeight: 700 }}
                >
                  Analiză AI · {formatMonthLabel(month)}
                </Typography>
              </Stack>
              <Typography component="h2" variant="h5" sx={{ mb: 1 }}>
                Descoperă unde poți economisi
              </Typography>
              <Typography sx={{ opacity: 0.9 }}>
                Analiza este realizată de serverul aplicației; datele tale nu
                sunt procesate în browser.
              </Typography>
            </Box>
            <Button
              size="large"
              variant="contained"
              onClick={runAnalysis}
              disabled={analysis.isPending}
              startIcon={
                result ? <RefreshCw size={18} /> : <Sparkles size={18} />
              }
              sx={{
                bgcolor: "#fff",
                color: palette.indigo,
                "&:hover": { bgcolor: "#eef2ff" },
                flexShrink: 0,
              }}
            >
              {analysis.isPending
                ? "Se analizează..."
                : result
                  ? "Analizează din nou"
                  : "Analizează situația mea"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Box aria-live="polite">
        {analysis.isPending && (
          <SectionCard
            title="Analizăm tranzacțiile tale"
            subtitle="Poate dura câteva secunde."
          >
            <LoadingBlock rows={3} height={90} />
          </SectionCard>
        )}

        {analysis.isError && (
          <ErrorState
            title="Analiza nu a putut fi finalizată"
            message={getErrorMessage(analysis.error)}
            onRetry={runAnalysis}
          />
        )}

        {result && !analysis.isPending && (
          <Stack spacing={3}>
            <SectionCard title="Rezumatul situației tale">
              <Typography>{result.summary}</Typography>
            </SectionCard>

            <Box>
              <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                Recomandări ({result.recommendations.length})
              </Typography>
              {result.recommendations.length === 0 ? (
                <Alert severity="info">
                  Nu avem recomandări pentru această lună.
                </Alert>
              ) : (
                <Box
                  component="ul"
                  sx={{
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    display: "grid",
                    gap: 2.5,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, 1fr)",
                      xl: "repeat(3, 1fr)",
                    },
                  }}
                >
                  {result.recommendations.map((recommendation) => (
                    <li key={recommendation.id}>
                      <RecommendationCard
                        recommendation={recommendation}
                        converted={convertedIds.includes(recommendation.id)}
                        onConvert={(r) =>
                          setDraft({ id: r.id, values: toGoalDraft(r) })
                        }
                      />
                    </li>
                  ))}
                </Box>
              )}
            </Box>

            <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
              Recomandările sunt generate automat și au caracter informativ.
              Estimările de economii nu sunt garanții și nu reprezintă
              consultanță financiară.
            </Alert>
          </Stack>
        )}
      </Box>

      <GoalFormDialog
        open={!!draft}
        initialValues={draft?.values}
        onClose={() => setDraft(null)}
        onCreated={() => draft && setConvertedIds((ids) => [...ids, draft.id])}
      />
    </>
  );
}
