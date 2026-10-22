import { useCallback, useMemo } from "react";
import { useSnackbar } from "notistack";

export function useToast() {
  const { enqueueSnackbar } = useSnackbar();
  const success = useCallback(
    (message: string) => enqueueSnackbar(message, { variant: "success" }),
    [enqueueSnackbar],
  );
  const error = useCallback(
    (message: string) => enqueueSnackbar(message, { variant: "error" }),
    [enqueueSnackbar],
  );
  return useMemo(() => ({ success, error }), [success, error]);
}
