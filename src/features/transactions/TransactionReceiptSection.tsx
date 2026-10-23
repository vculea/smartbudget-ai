import { Alert, Button, Link, Stack, Typography } from "@mui/material";
import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import type { Transaction } from "../../types";
import { RECEIPT_FILE_ACCEPT } from "../../utils/image";
import { isDriveLink } from "./driveLink";
import { useAttachReceipt, useDetachReceipt } from "./hooks";

interface TransactionReceiptSectionProps {
  transaction: Transaction;
  /** Fără cont Google Drive configurat se poate doar deschide sau scoate un fișier deja salvat. */
  driveEnabled: boolean;
}

/** Bonul / factura unei tranzacții existente: deschidere în Google Drive, înlocuire sau scoatere. */
export function TransactionReceiptSection({
  transaction,
  driveEnabled,
}: TransactionReceiptSectionProps) {
  const attach = useAttachReceipt();
  const detach = useDetachReceipt();
  const fileInput = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState({
    name: transaction.attachmentName ?? null,
    url: transaction.attachmentUrl ?? null,
  });
  const busy = attach.isPending || detach.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const saved = await attach.mutateAsync({ id: transaction.id, file });
      setCurrent({
        name: saved.attachmentName ?? null,
        url: saved.attachmentUrl ?? null,
      });
    } catch {
      // Eroarea este afișată de hook.
    }
  };

  const onRemove = async () => {
    try {
      await detach.mutateAsync(transaction.id);
      setCurrent({ name: null, url: null });
    } catch {
      // Eroarea este afișată de hook.
    }
  };

  return (
    <Stack spacing={1} data-testid="receipt-section">
      <input
        ref={fileInput}
        type="file"
        accept={RECEIPT_FILE_ACCEPT}
        hidden
        data-testid="attachment-input"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {current.url ? (
        <Alert
          severity="success"
          icon={<Paperclip size={18} />}
          action={
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={() => void onRemove()}
            >
              Scoate
            </Button>
          }
        >
          {isDriveLink(current.url) ? (
            <Link href={current.url} target="_blank" rel="noopener noreferrer">
              {current.name ?? "Deschide fișierul"}
            </Link>
          ) : (
            <Typography variant="body2">{current.name}</Typography>
          )}
          <Typography variant="caption" display="block">
            Salvat în Google Drive
          </Typography>
        </Alert>
      ) : null}
      {driveEnabled && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Paperclip size={16} />}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {attach.isPending
            ? "Se salvează în Google Drive..."
            : current.url
              ? "Înlocuiește fișierul din Google Drive"
              : "Salvează bonul / factura în Google Drive"}
        </Button>
      )}
    </Stack>
  );
}
