import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { getErrorMessage } from "../../api";
import type { Category } from "../../types";
import { useCategoryUsage, useDeleteCategory } from "./hooks";

interface DeleteCategoryDialogProps {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
}

export function DeleteCategoryDialog({
  category: requested,
  categories,
  onClose,
}: DeleteCategoryDialogProps) {
  // Ultima categorie rămâne afișată cât timp dialogul se închide animat.
  const [category, setCategory] = useState(requested);
  if (requested && requested !== category) setCategory(requested);
  const open = requested !== null;

  const remove = useDeleteCategory();
  const usage = useCategoryUsage(category?.id, open);
  const [replacementId, setReplacementId] = useState("");

  const close = () => {
    if (remove.isPending) return;
    setReplacementId("");
    remove.reset();
    onClose();
  };

  const inUse =
    !!usage.data && (usage.data.transactions > 0 || usage.data.budgets > 0);
  const candidates = categories.filter(
    (c) => category && c.type === category.type && c.id !== category.id,
  );
  const canDelete =
    !!category && usage.isSuccess && (!inUse || replacementId !== "");

  const confirm = async () => {
    if (!category) return;
    try {
      await remove.mutateAsync({
        id: category.id,
        replacementId: inUse ? replacementId : undefined,
      });
      setReplacementId("");
      onClose();
    } catch {
      // Eroarea este afișată în dialog și printr-un toast.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="xs"
      fullWidth
      aria-labelledby="delete-category-title"
    >
      <DialogTitle id="delete-category-title">Ștergi categoria?</DialogTitle>
      <DialogContent>
        {usage.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={28} aria-label="Se verifică utilizarea" />
          </Box>
        ) : usage.isError ? (
          <Alert severity="error">{getErrorMessage(usage.error)}</Alert>
        ) : (
          <Stack spacing={2}>
            {remove.isError && (
              <Alert severity="error">{getErrorMessage(remove.error)}</Alert>
            )}
            {!inUse ? (
              <DialogContentText>
                Categoria „{category?.name}” nu este folosită și va fi ștearsă
                definitiv.
              </DialogContentText>
            ) : (
              <>
                <DialogContentText>
                  „{category?.name}” are {usage.data?.transactions}{" "}
                  {usage.data?.transactions === 1 ? "tranzacție" : "tranzacții"}{" "}
                  și {usage.data?.budgets}{" "}
                  {usage.data?.budgets === 1 ? "buget" : "bugete"}. Alege
                  categoria în care să fie mutate. Dacă acea categorie are deja
                  buget într-o lună, bugetul categoriei șterse din luna
                  respectivă se elimină.
                </DialogContentText>
                {candidates.length === 0 ? (
                  <Alert severity="warning">
                    Nu ai altă categorie de același tip. Creează una întâi, apoi
                    revino să o ștergi pe aceasta.
                  </Alert>
                ) : (
                  <TextField
                    select
                    label="Mută în categoria"
                    value={replacementId}
                    onChange={(e) => setReplacementId(e.target.value)}
                    required
                  >
                    {candidates.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={close} disabled={remove.isPending}>
          Anulează
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => void confirm()}
          disabled={!canDelete || remove.isPending}
        >
          {remove.isPending
            ? "Se șterge..."
            : inUse
              ? "Mută și șterge"
              : "Șterge"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
