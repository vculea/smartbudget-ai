import { Alert, Box, CircularProgress, Paper, Typography } from "@mui/material";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { LineChart } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getErrorMessage } from "../../api/errors";
import { palette } from "../../app/theme";
import { useAuth } from "../../auth/AuthContext";
import { env } from "../../config/env";

interface LocationState {
  from?: { pathname?: string; search?: string };
}

export function LoginPage() {
  const { isAuthenticated, loginWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const from = (location.state as LocationState | null)?.from;
  const destination = from?.pathname
    ? `${from.pathname}${from.search ?? ""}`
    : "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  const handleCredential = async (credential: string | undefined) => {
    if (!credential) {
      setError("Google nu a returnat un credențial. Încearcă din nou.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(getErrorMessage(err, "Autentificarea a eșuat. Încearcă din nou."));
      setPending(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Paper
        component="main"
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 420,
          p: { xs: 3, sm: 5 },
          textAlign: "center",
          display: "grid",
          gap: 3,
          justifyItems: "center",
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            background: `linear-gradient(135deg, ${palette.indigo}, ${palette.violet})`,
            boxShadow: "0 8px 20px rgba(79, 70, 229, 0.35)",
          }}
        >
          <LineChart size={30} />
        </Box>
        <Box>
          <Typography component="h1" variant="h5">
            SmartBudget AI
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Autentifică-te cu contul tău Google pentru a-ți vedea bugetul.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>
            {error}
          </Alert>
        )}

        {!env.googleClientId ? (
          <Alert severity="warning" sx={{ width: "100%", textAlign: "left" }}>
            Autentificarea cu Google nu este configurată. Setează
            VITE_GOOGLE_CLIENT_ID și reconstruiește aplicația.
          </Alert>
        ) : pending ? (
          <CircularProgress aria-label="Se autentifică" />
        ) : (
          <GoogleOAuthProvider clientId={env.googleClientId}>
            <GoogleLogin
              onSuccess={(response) => void handleCredential(response.credential)}
              onError={() =>
                setError("Autentificarea cu Google a eșuat sau a fost anulată.")
              }
              text="signin_with"
              shape="pill"
              size="large"
            />
          </GoogleOAuthProvider>
        )}
      </Paper>
    </Box>
  );
}
