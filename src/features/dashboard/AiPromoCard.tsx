import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { palette } from "../../app/theme";

export function AiPromoCard() {
  return (
    <Card
      sx={{
        height: "100%",
        color: "#fff",
        border: "none",
        background: `linear-gradient(150deg, ${palette.indigo} 0%, ${palette.violet} 100%)`,
      }}
    >
      <CardContent
        sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(255,255,255,0.18)",
            mb: 2,
          }}
        >
          <Sparkles size={22} />
        </Box>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
          Analiză cu AI Coach
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 3 }}>
          Primește recomandări personalizate și estimări orientative de
          economii, pe baza obiceiurilor tale de cheltuieli.
        </Typography>
        <Button
          component={Link}
          to="/ai-insights"
          variant="contained"
          sx={{
            mt: "auto",
            bgcolor: "#fff",
            color: palette.indigo,
            "&:hover": { bgcolor: "#eef2ff" },
          }}
        >
          Analizează situația mea
        </Button>
      </CardContent>
    </Card>
  );
}
