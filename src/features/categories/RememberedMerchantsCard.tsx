import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Brain, Trash2 } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../../api";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { SectionCard } from "../../components/common/SectionCard";
import type { Category } from "../../types";
import { useForgetMerchant, useRememberedMerchants } from "./hooks";

/** Comercianții învățați din importuri și corecturi; utilizatorul poate șterge o asociere greșită. */
export function RememberedMerchantsCard({
  categoriesById,
}: {
  categoriesById: Map<string, Category>;
}) {
  const { data, isLoading, isError, error, refetch } = useRememberedMerchants();
  const forget = useForgetMerchant();
  const [confirmAll, setConfirmAll] = useState(false);
  const merchants = data ?? [];

  const forgetAll = async () => {
    try {
      await forget.mutateAsync(undefined);
      setConfirmAll(false);
    } catch {
      // Eroarea este afișată prin toast din hook.
    }
  };

  return (
    <SectionCard
      title="Categorii învățate"
      subtitle="Comercianții pentru care importul alege singur categoria, după alegerile și corecturile tale."
      action={
        merchants.length > 0 && (
          <Button
            size="small"
            color="error"
            onClick={() => setConfirmAll(true)}
            sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Uită tot
          </Button>
        )
      }
      flush
    >
      {isLoading ? (
        <LoadingBlock rows={1} height={120} />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : merchants.length === 0 ? (
        <Stack
          alignItems="center"
          spacing={1}
          sx={{ py: 4, px: 3, color: "text.secondary", textAlign: "center" }}
        >
          <Brain size={24} aria-hidden />
          <Typography variant="body2">
            Încă nu am învățat nimic. Importă tranzacții sau corectează
            categoria unei tranzacții și o vom reține pentru data viitoare.
          </Typography>
        </Stack>
      ) : (
        <List
          dense
          aria-label="Categorii învățate"
          sx={{ maxHeight: 360, overflowY: "auto" }}
        >
          {merchants.map((merchant) => {
            const category = categoriesById.get(merchant.categoryId);
            const times =
              merchant.hits === 1 ? "o tranzacție" : `${merchant.hits} tranzacții`;
            return (
              <ListItem
                key={`${merchant.type}|${merchant.key}`}
                divider
                sx={{ px: 3 }}
                secondaryAction={
                  <Tooltip title="Uită">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Uită ${merchant.key}`}
                      disabled={forget.isPending}
                      onClick={() =>
                        forget.mutate({ type: merchant.type, key: merchant.key })
                      }
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={merchant.key}
                  secondary={
                    merchant.certain
                      ? `${category?.name ?? "Categorie ștearsă"} · ${times}`
                      : `Categorii diferite (mai des ${category?.name ?? "—"}) · alegi tu la import`
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}

      <Dialog
        open={confirmAll}
        onClose={() => !forget.isPending && setConfirmAll(false)}
        maxWidth="xs"
        aria-labelledby="forget-all-title"
      >
        <DialogTitle id="forget-all-title">Uiți toate categoriile învățate?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tranzacțiile rămân neschimbate. La importurile următoare categoriile
            vor fi propuse din nou de AI.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            color="inherit"
            onClick={() => setConfirmAll(false)}
            disabled={forget.isPending}
          >
            Anulează
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void forgetAll()}
            disabled={forget.isPending}
          >
            Uită tot
          </Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}
