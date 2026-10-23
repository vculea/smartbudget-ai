import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, getErrorMessage } from "../../api";
import { useAiSettings } from "../../config/aiSettings";
import type {
  ScanProgress,
  Transaction,
  TransactionScan,
  TransactionType,
} from "../../types";
import { todayIso } from "../../utils/date";
import { RECEIPT_FILE_ACCEPT } from "../../utils/image";
import {
  amountField,
  isoDateField,
  parseAmount,
  requiredText,
} from "../../utils/validation";
import { useCategories } from "../categories/useCategories";
import {
  useAttachReceipt,
  useDriveEnabled,
  useSaveTransaction,
  useScanTransaction,
} from "./hooks";
import { ScannedTransactionsReview } from "./ScannedTransactionsReview";
import { TransactionReceiptSection } from "./TransactionReceiptSection";

const DESCRIPTION_MAX = 120;

function scanProgressText(progress: ScanProgress | null, local: boolean): string {
  switch (progress?.phase) {
    case "writing":
      return `Modelul scrie răspunsul: ${progress.receivedChars} caractere primite`;
    case "thinking":
      return "Modelul analizează conținutul pozei";
    case "waiting":
      return local
        ? "Modelul local se încarcă și citește poza; la prima folosire poate dura câteva minute"
        : "AI-ul citește poza";
    default:
      return "Se pregătește poza pentru AI";
  }
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

const schema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: amountField,
  description: requiredText("Descrierea"),
  transactionDate: isoDateField("Selectează data tranzacției"),
  categoryId: z.string().min(1, "Selectează o categorie"),
});

type FormValues = z.infer<typeof schema>;

interface TransactionFormDialogProps {
  open: boolean;
  /** Dacă este setată, dialogul editează tranzacția. */
  transaction?: Transaction | null;
  onClose: () => void;
}

export function TransactionFormDialog({
  open,
  transaction,
  onClose,
}: TransactionFormDialogProps) {
  const isEdit = !!transaction;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="transaction-dialog-title"
    >
      <DialogTitle id="transaction-dialog-title">
        {isEdit ? "Editează tranzacția" : "Tranzacție nouă"}
      </DialogTitle>
      <TransactionForm transaction={transaction ?? null} onClose={onClose} />
    </Dialog>
  );
}

function TransactionForm({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const {
    categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
  } = useCategories();
  const save = useSaveTransaction();
  const scan = useScanTransaction();
  const attach = useAttachReceipt();
  const driveEnabled = useDriveEnabled();
  const aiMode = useAiSettings().mode;
  const fileInput = useRef<HTMLInputElement>(null);
  const scanAbort = useRef<AbortController | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saveToDrive, setSaveToDrive] = useState(true);
  const [scanned, setScanned] = useState<TransactionScan | null>(null);
  const [review, setReview] = useState<TransactionScan[] | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanStartedAt, setScanStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Închiderea dialogului oprește și citirea în curs (modelul local nu mai lucrează degeaba).
  useEffect(() => () => scanAbort.current?.abort(), []);

  useEffect(() => {
    if (!scan.isPending) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scan.isPending]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: transaction?.type ?? "EXPENSE",
      amount: transaction ? String(transaction.amount) : "",
      description: transaction?.description ?? "",
      transactionDate: transaction?.transactionDate ?? todayIso(),
      categoryId: transaction ? String(transaction.categoryId) : "",
    },
  });

  const type = watch("type");
  const categoryId = watch("categoryId");
  const availableCategories = categories.filter((c) => c.type === type);

  // O categorie care nu aparține tipului ales se golește.
  useEffect(() => {
    if (
      categoryId &&
      categories.length > 0 &&
      !availableCategories.some((c) => String(c.id) === categoryId)
    ) {
      setValue("categoryId", "");
    }
  }, [type, categories, categoryId, availableCategories, setValue]);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setReceiptFile(file);
    setScanned(null);
    setProgress(null);
    scanAbort.current?.abort();
    const controller = new AbortController();
    scanAbort.current = controller;
    setScanStartedAt(Date.now());
    setNow(Date.now());
    try {
      const results = await scan.mutateAsync({
        image: file,
        options: {
          signal: controller.signal,
          onProgress: (next) => {
            if (!controller.signal.aborted) setProgress(next);
          },
        },
      });
      if (controller.signal.aborted) return;
      if (results.length > 1) {
        setReview(results);
        return;
      }
      const result = results[0];
      if (!result) return;
      const options = { shouldValidate: true, shouldDirty: true };
      setValue("type", result.type, options);
      if (result.amount !== null) setValue("amount", String(result.amount), options);
      if (result.description)
        setValue("description", result.description.slice(0, DESCRIPTION_MAX), options);
      if (result.transactionDate)
        setValue("transactionDate", result.transactionDate, options);
      setValue("categoryId", result.categoryId ?? "", options);
      setScanned(result);
    } catch {
      // Eroarea este afișată din starea mutației.
    }
  };

  const cancelScan = () => {
    scanAbort.current?.abort();
    scanAbort.current = null;
    setProgress(null);
    scan.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: transaction?.id,
        input: {
          type: values.type,
          amount: parseAmount(values.amount),
          description: values.description.trim(),
          transactionDate: values.transactionDate,
          categoryId: values.categoryId,
        },
      });
      if (!transaction && receiptFile && saveToDrive && driveEnabled) {
        // Tranzacția este deja salvată; dacă fișierul nu urcă, hook-ul arată eroarea și dialogul se închide oricum.
        await attach
          .mutateAsync({ id: saved.id, file: receiptFile })
          .catch(() => undefined);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          if (field in schema.shape)
            setError(field as keyof FormValues, { message });
        });
      }
    }
  });

  if (review) {
    return (
      <ScannedTransactionsReview
        scans={review}
        categories={categories}
        categoriesLoading={categoriesLoading}
        onBack={() => setReview(null)}
        onSaved={onClose}
      />
    );
  }

  const elapsed = Math.max(0, Math.round((now - scanStartedAt) / 1000));

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {save.isError && (
            <Alert severity="error">{getErrorMessage(save.error)}</Alert>
          )}
          {categoriesError && (
            <Alert severity="error">
              Categoriile nu au putut fi încărcate.
            </Alert>
          )}

          {!transaction && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={RECEIPT_FILE_ACCEPT}
                hidden
                data-testid="receipt-input"
                onChange={(event) => {
                  void handleFileSelected(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <Button
                variant="outlined"
                startIcon={<Camera size={18} />}
                disabled={scan.isPending || save.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {scan.isPending
                  ? "Se citește poza..."
                  : "Completează din poză sau PDF (bon, factură)"}
              </Button>
              {scan.isPending && (
                <Alert
                  severity="info"
                  data-testid="scan-ai-notice"
                  action={
                    <Button color="inherit" size="small" onClick={cancelScan}>
                      Oprește
                    </Button>
                  }
                >
                  <Stack spacing={1}>
                    <span>
                      {scanProgressText(progress, aiMode === "local")} (
                      {formatElapsed(elapsed)})
                    </span>
                    <LinearProgress aria-label="Progresul citirii pozei" />
                  </Stack>
                </Alert>
              )}
              {scan.isError && (
                <Alert severity="error">{getErrorMessage(scan.error)}</Alert>
              )}
              {scanned && (
                <Alert severity={scanned.amount === null ? "warning" : "info"}>
                  Am completat câmpurile din poză. Verifică-le și modifică ce
                  nu este corect
                  {scanned.amount === null && " (suma nu a putut fi citită)"}
                  {scanned.categoryId === null &&
                    " (alege categoria manual)"}
                  , apoi adaugă tranzacția.
                </Alert>
              )}
              {driveEnabled && receiptFile && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={saveToDrive}
                      onChange={(event) => setSaveToDrive(event.target.checked)}
                    />
                  }
                  label={`Salvează fișierul „${receiptFile.name}” în Google Drive`}
                />
              )}
            </>
          )}

          {transaction && (driveEnabled || transaction.attachmentUrl) && (
            <TransactionReceiptSection
              transaction={transaction}
              driveEnabled={driveEnabled}
            />
          )}

          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={field.value}
                aria-label="Tip tranzacție"
                onChange={(_, value: TransactionType | null) =>
                  value && field.onChange(value)
                }
              >
                <ToggleButton value="EXPENSE">Cheltuială</ToggleButton>
                <ToggleButton value="INCOME">Venit</ToggleButton>
              </ToggleButtonGroup>
            )}
          />

          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Sumă"
                autoFocus
                required
                error={!!errors.amount}
                helperText={errors.amount?.message}
                slotProps={{
                  htmlInput: { inputMode: "decimal" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">lei</InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descriere"
                required
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Categorie"
                  required
                  disabled={categoriesLoading}
                  error={!!errors.categoryId}
                  helperText={errors.categoryId?.message}
                >
                  {availableCategories.map((category) => (
                    <MenuItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="transactionDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Data"
                  required
                  error={!!errors.transactionDate}
                  helperText={errors.transactionDate?.message}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={save.isPending}>
          Anulează
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={save.isPending || attach.isPending || scan.isPending}
        >
          {save.isPending || attach.isPending
            ? "Se salvează..."
            : transaction
              ? "Salvează modificările"
              : "Adaugă tranzacția"}
        </Button>
      </DialogActions>
    </form>
  );
}
