import { Box, Button, Typography } from "@mui/material";
import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Box sx={{ textAlign: "center", py: 10 }}>
      <Compass size={48} color="#4f46e5" />
      <Typography component="h1" variant="h4" sx={{ mt: 2 }}>
        Pagina nu a fost găsită
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Adresa accesată nu există în aplicație.
      </Typography>
      <Button component={Link} to="/dashboard" variant="contained">
        Înapoi la Dashboard
      </Button>
    </Box>
  );
}
