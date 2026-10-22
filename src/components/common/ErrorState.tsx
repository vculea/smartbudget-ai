import { Alert, Button } from "@mui/material";
import { RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message,
  title = "Nu am putut încărca datele",
  onRetry,
}: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      sx={{ borderRadius: 3, bgcolor: "background.paper" }}
      action={
        onRetry && (
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshCw size={16} />}
            onClick={onRetry}
          >
            Reîncearcă
          </Button>
        )
      }
    >
      <strong>{title}.</strong> {message}
    </Alert>
  );
}
