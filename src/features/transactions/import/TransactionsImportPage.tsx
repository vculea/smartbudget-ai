import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { ArrowLeft, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../../components/common/PageHeader";
import type { Category, TransactionType } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { useCategories } from "../../categories/useCategories";
import { useImportTransactions } from "../hooks";
import {
  IMPORT_FILE_ACCEPT,
  ImportFileError,
  MAX_IMPORT_ROWS,
  sameDescriptionKey,
  toTransactionInput,
  validateDraft,
  type DraftErrors,
  type ImportDraft,
} from "./importParser";
import {
  loadImport,
  memoryLessons,
  rememberedCategories,
  suggestMissingCategories,
  type CategoryUpdate,
} from "./importWorkflow";

const RETRY_BATCH = 10;
const MIN_GRID_HEIGHT = 120;

// Înălțimea gridului astfel încât pagina să încapă în fereastră și să deruleze
// doar gridul, nu și pagina.
function useFitGridHeight(
  active: boolean,
  gridRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
) {
  const [height, setHeight] = useState(480);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!active || !grid) return;
    const main = grid.closest("main");

    const fit = () => {
      const top = grid.getBoundingClientRect().top + window.scrollY;
      const footer = footerRef.current?.offsetHeight ?? 0;
      const bottomPadding = main
        ? parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 0;
      setHeight(
        Math.max(
          MIN_GRID_HEIGHT,
          Math.floor(window.innerHeight - top - footer - bottomPadding),
        ),
      );
    };

    fit();
    window.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    if (main) observer.observe(main);
    return () => {
      window.removeEventListener("resize", fit);
      observer.disconnect();
    };
  }, [active, gridRef, footerRef]);

  return height;
}

interface PreviewRow {
  draft: ImportDraft;
  included: boolean;
}

export function TransactionsImportPage() {
  const navigate = useNavigate();
  const { categories, byId, isLoading: categoriesLoading } = useCategories();
  const importMutation = useImportTransactions();
  const fileInput = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading">("idle");
  const [dragging, setDragging] = useState(false);
  const [mappingSource, setMappingSource] = useState<"ai" | "header">("ai");
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [propagated, setPropagated] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  // Un import nou sau părăsirea paginii oprește sugestiile AI în curs.
  const runId = useRef(0);
  useEffect(
    () => () => {
      runId.current++;
    },
    [],
  );

  const reading = phase === "reading";
  const gridHeight = useFitGridHeight(rows !== null, gridRef, footerRef);

  const applySuggestions = useCallback(
    (updates: Map<string, CategoryUpdate>) =>
      setRows(
        (current) =>
          current?.map((row) => {
            const update = updates.get(row.draft.key);
            // Ce a ales deja utilizatorul rămâne neatins.
            if (!update || row.draft.categoryId) return row;
            const category = update.categoryId
              ? byId.get(update.categoryId)
              : undefined;
            const draft: ImportDraft =
              category && category.type === row.draft.type
                ? {
                    ...row.draft,
                    categoryId: category.id,
                    suggestedCategoryId: category.id,
                    aiState:
                      update.source === "memory" ? "remembered" : "suggested",
                  }
                : { ...row.draft, aiState: "unsure" };
            return { ...row, draft };
          }) ?? null,
      ),
    [byId],
  );

  const runSuggestions = async (
    drafts: ImportDraft[],
    id: number,
    batchSize?: number,
  ) => {
    const pending = drafts.filter((d) => !d.categoryId).length;
    if (pending === 0) return;
    setCategoryError(null);
    setProgress({ done: 0, total: pending });
    const failure = await suggestMissingCategories(
      drafts,
      (updates, done, total) => {
        applySuggestions(updates);
        setProgress({ done, total });
      },
      () => id !== runId.current,
      undefined,
      batchSize,
    );
    if (id !== runId.current) return;
    setProgress(null);
    setCategoryError(failure);
  };

  // Trimite din nou la AI rândurile bifate fără categorie, în loturi mici ca modelul să se concentreze mai bine.
  const improveAnswer = async () => {
    const id = ++runId.current;
    await runSuggestions(
      selected.map((row) => row.draft).filter((draft) => !draft.categoryId),
      id,
      RETRY_BATCH,
    );
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const id = ++runId.current;
    setError(null);
    setNotice(null);
    setCategoryError(null);
    setPropagated(null);
    setProgress(null);
    setPhase("reading");
    try {
      const loaded = await loadImport(file, categories);
      if (id !== runId.current) return;
      setFileName(file.name);
      setMappingSource(loaded.mappingSource);
      setNotice(loaded.note ?? null);
      setRows(loaded.drafts.map((draft) => ({ draft, included: true })));
      setPhase("idle");

      // Mai întâi alegerile anterioare ale utilizatorului; AI-ul primește doar ce a rămas.
      const remembered = await rememberedCategories(loaded.drafts);
      if (id !== runId.current) return;
      applySuggestions(remembered);
      await runSuggestions(
        loaded.drafts.filter((draft) => {
          const categoryId = remembered.get(draft.key)?.categoryId;
          return !(categoryId && byId.get(categoryId)?.type === draft.type);
        }),
        id,
      );
    } catch (e) {
      if (id !== runId.current) return;
      setRows(null);
      setPhase("idle");
      setError(
        e instanceof ImportFileError
          ? e.message
          : "Fișierul nu a putut fi procesat.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const updateDraft = useCallback(
    (key: string, patch: Partial<ImportDraft>) => {
      const current = rowsRef.current ?? [];
      const changed = current.find((row) => row.draft.key === key)?.draft;
      // O categorie aleasă de mână se aplică și rândurilor cu aceeași descriere pe care utilizatorul nu le-a ales încă.
      const sameKey =
        changed && patch.categoryId && !patch.type
          ? sameDescriptionKey(changed)
          : null;
      const follows = (draft: ImportDraft) =>
        sameKey !== null &&
        draft.key !== key &&
        draft.categoryId !== patch.categoryId &&
        (draft.aiState !== undefined || !draft.categoryId) &&
        sameDescriptionKey(draft) === sameKey;
      const followers = current.filter((row) => follows(row.draft)).length;

      setRows(
        (rows) =>
          rows?.map((row) => {
            if (row.draft.key !== key) {
              if (!follows(row.draft)) return row;
              const draft = { ...row.draft, categoryId: patch.categoryId! };
              delete draft.aiState;
              return { ...row, draft };
            }
            const draft = { ...row.draft, ...patch };
            // O categorie care nu aparține noului tip se golește.
            if (patch.type && byId.get(draft.categoryId)?.type !== patch.type) {
              draft.categoryId = "";
            }
            if (patch.type || patch.categoryId !== undefined) {
              delete draft.aiState;
            }
            return { ...row, draft };
          }) ?? null,
      );
      if (followers > 0) {
        setPropagated(
          followers === 1
            ? "Am pus aceeași categorie și la încă un rând cu aceeași descriere."
            : `Am pus aceeași categorie și la alte ${followers} rânduri cu aceeași descriere.`,
        );
      }
    },
    [byId],
  );

  const toggleIncluded = useCallback(
    (key: string, included: boolean) =>
      setRows((current) =>
        current?.map((row) =>
          row.draft.key === key ? { ...row, included } : row,
        ) ?? null,
      ),
    [],
  );

  const errorsByKey = useMemo(
    () =>
      new Map(
        (rows ?? []).map(({ draft }) => [draft.key, validateDraft(draft, byId)]),
      ),
    [rows, byId],
  );

  const selected = (rows ?? []).filter((row) => row.included);
  const invalidSelected = selected.filter(
    (row) => Object.keys(errorsByKey.get(row.draft.key) ?? {}).length > 0,
  );
  const allSelected = !!rows && rows.length > 0 && selected.length === rows.length;
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const { draft } of selected) {
      const value = Number(draft.amount.replace(",", "."));
      if (!Number.isFinite(value)) continue;
      if (draft.type === "INCOME") income += value;
      else expense += value;
    }
    return { income, expense };
  }, [selected]);

  const remembered = selected.filter(
    (r) => r.draft.aiState === "remembered",
  ).length;
  const aiPicked = selected.filter((r) => r.draft.aiState === "suggested").length;
  const aiUnsure = selected.filter((r) => r.draft.aiState === "unsure").length;
  const categorizing = progress !== null;
  const pendingCategories = selected.filter((r) => !r.draft.categoryId).length;

  const canSave =
    selected.length > 0 &&
    invalidSelected.length === 0 &&
    !categorizing &&
    !importMutation.isPending;

  const save = async () => {
    const drafts = selected.map((row) => row.draft);
    try {
      await importMutation.mutateAsync({
        inputs: drafts.map(toTransactionInput),
        lessons: memoryLessons(drafts),
      });
      navigate("/transactions");
    } catch {
      // Eroarea este afișată prin toast din hook.
    }
  };

  return (
    <>
      <PageHeader
        title="Import tranzacții"
        subtitle="Încarcă un fișier CSV sau Excel, verifică tranzacțiile și adaugă-le."
        actions={
          <Button
            startIcon={<ArrowLeft size={18} />}
            onClick={() => navigate("/transactions")}
          >
            Înapoi la tranzacții
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {rows === null ? (
        <UploadCard
          dragging={dragging}
          busy={reading || categoriesLoading}
          onDragging={setDragging}
          onPick={() => fileInput.current?.click()}
          onFile={(file) => void handleFile(file)}
        />
      ) : (
        <Card>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            sx={{ p: 2 }}
          >
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FileSpreadsheet size={18} aria-hidden />
                <Typography sx={{ fontWeight: 600 }}>{fileName}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {rows.length} rânduri citite · {selected.length} selectate ·
                Venituri {formatCurrency(totals.income)} · Cheltuieli{" "}
                {formatCurrency(totals.expense)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Coloane recunoscute{" "}
                {mappingSource === "ai" ? "de AI" : "după titluri"}
                {remembered > 0 && ` · Categorii reținute: ${remembered}`}
                {aiPicked + aiUnsure > 0 &&
                  ` · Categorii alese de AI: ${aiPicked} · De ales de tine: ${aiUnsure}`}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {invalidSelected.length > 0 && (
                <Chip
                  color="error"
                  variant="outlined"
                  label={`${invalidSelected.length} rânduri de corectat`}
                />
              )}
              {pendingCategories > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<Sparkles size={18} />}
                  disabled={categorizing || importMutation.isPending}
                  onClick={() => void improveAnswer()}
                >
                  Îmbunătățește răspunsul
                </Button>
              )}
              <Button onClick={() => fileInput.current?.click()}>
                Alege alt fișier
              </Button>
            </Stack>
          </Stack>

          {progress && (
            <Box sx={{ px: 2, pb: 2 }} role="status">
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                AI-ul alege categoriile… {progress.done} din {progress.total}
              </Typography>
              <LinearProgress
                variant={progress.done > 0 ? "determinate" : "indeterminate"}
                value={(progress.done / Math.max(1, progress.total)) * 100}
              />
            </Box>
          )}
          {notice && (
            <Alert severity="info" sx={{ mx: 2, mb: 2 }}>
              {notice}
            </Alert>
          )}
          {propagated && (
            <Alert
              severity="info"
              sx={{ mx: 2, mb: 2 }}
              onClose={() => setPropagated(null)}
            >
              {propagated}
            </Alert>
          )}
          {categoryError && (
            <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>
              AI-ul nu a putut alege categoriile: {categoryError} Alege-le
              manual.
            </Alert>
          )}
          {invalidSelected.length > 0 && !categorizing && (
            <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>
              Corectează rândurile marcate (de exemplu alege categoria unde AI-ul
              nu a știut) sau debifează-le ca să nu fie importate.
            </Alert>
          )}

          <TableContainer ref={gridRef} sx={{ maxHeight: gridHeight }}>
            <Table
              stickyHeader
              size="small"
              aria-label="Previzualizare import"
              sx={{ minWidth: 1040, tableLayout: "fixed" }}
            >
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={checkboxCellSx}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selected.length > 0 && !allSelected}
                      onChange={(_, checked) =>
                        setRows((current) =>
                          current?.map((row) => ({ ...row, included: checked })) ??
                          null,
                        )
                      }
                      slotProps={{
                        input: { "aria-label": "Selectează toate rândurile" },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ width: 72 }}>Rând</TableCell>
                  <TableCell sx={{ width: 200 }}>Data</TableCell>
                  <TableCell>Descriere</TableCell>
                  <TableCell sx={{ width: 190 }}>Tip</TableCell>
                  <TableCell sx={{ width: 190 }}>Categorie</TableCell>
                  <TableCell align="right" sx={{ width: 125 }}>
                    Sumă
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <PreviewTableRow
                    key={row.draft.key}
                    draft={row.draft}
                    included={row.included}
                    errors={errorsByKey.get(row.draft.key) ?? {}}
                    categories={categories}
                    onChange={updateDraft}
                    onToggle={toggleIncluded}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack
            ref={footerRef}
            direction="row"
            spacing={1.5}
            justifyContent="flex-end"
            sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}
          >
            <Button onClick={() => navigate("/transactions")}>Anulează</Button>
            <Button
              variant="contained"
              disabled={!canSave}
              onClick={() => void save()}
            >
              {importMutation.isPending
                ? "Se adaugă…"
                : `Adaugă ${selected.length} ${selected.length === 1 ? "tranzacție" : "tranzacții"}`}
            </Button>
          </Stack>
        </Card>
      )}

      <input
        ref={fileInput}
        type="file"
        hidden
        accept={IMPORT_FILE_ACCEPT}
        aria-label="Fișier de importat"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </>
  );
}

function UploadCard({
  dragging,
  busy,
  onDragging,
  onPick,
  onFile,
}: {
  dragging: boolean;
  busy: boolean;
  onDragging: (value: boolean) => void;
  onPick: () => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <Card>
      <Box
        onDragOver={(event) => {
          event.preventDefault();
          onDragging(true);
        }}
        onDragLeave={() => onDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragging(false);
          onFile(event.dataTransfer.files[0]);
        }}
        sx={{
          m: 2,
          p: { xs: 3, sm: 6 },
          textAlign: "center",
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 2,
          bgcolor: dragging ? "action.hover" : "transparent",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Upload size={36} aria-hidden />
          <Typography variant="h6">Trage aici fișierul sau alege-l</Typography>
          <Button variant="contained" disabled={busy} onClick={onPick}>
            {busy ? "Se analizează fișierul…" : "Alege fișier CSV / Excel"}
          </Button>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 560 }}
          >
            Formate: .csv și .xlsx (prima foaie), până la {MAX_IMPORT_ROWS}{" "}
            de rânduri. AI-ul ales în Setări AI recunoaște coloanele (data,
            descrierea, suma, tipul) și propune categoria fiecărei tranzacții;
            unde nu e sigur, rândul rămâne marcat ca să alegi tu categoria. Poți
            corecta totul în pasul următor, înainte de salvare. Categoriile pe
            care le păstrezi sau le corectezi sunt reținute și completate singure
            la importurile următoare. Descrierile tranzacțiilor sunt trimise
            modelului AI ales.
          </Typography>
        </Stack>
      </Box>
    </Card>
  );
}

// "&&" outranks MUI's small-table checkbox rule that forces width: 24
const checkboxCellSx = { "&&": { width: 64, pl: 1, pr: 1 } };

interface PreviewTableRowProps {
  draft: ImportDraft;
  included: boolean;
  errors: DraftErrors;
  categories: Category[];
  onChange: (key: string, patch: Partial<ImportDraft>) => void;
  onToggle: (key: string, included: boolean) => void;
}

const PreviewTableRow = memo(function PreviewTableRow({
  draft,
  included,
  errors,
  categories,
  onChange,
  onToggle,
}: PreviewTableRowProps) {
  const label = (name: string) => `${name} rând ${draft.sourceRow}`;
  const hasErrors = included && Object.keys(errors).length > 0;
  const show = (message: string | undefined) => (included ? message : undefined);
  const options = categories.filter((c) => c.type === draft.type);

  return (
    <TableRow
      hover
      sx={{
        opacity: included ? 1 : 0.5,
        bgcolor: hasErrors
          ? (theme) => alpha(theme.palette.error.main, 0.08)
          : undefined,
        "& td": { verticalAlign: "top" },
      }}
      data-invalid={hasErrors || undefined}
    >
      <TableCell padding="checkbox" sx={checkboxCellSx}>
        <Checkbox
          checked={included}
          onChange={(_, checked) => onToggle(draft.key, checked)}
          slotProps={{ input: { "aria-label": label("Include") } }}
        />
      </TableCell>
      <TableCell sx={{ color: "text.secondary" }}>{draft.sourceRow}</TableCell>
      <TableCell>
        <TextField
          type="date"
          fullWidth
          size="small"
          value={draft.transactionDate}
          error={!!show(errors.transactionDate)}
          helperText={show(errors.transactionDate)}
          onChange={(e) => onChange(draft.key, { transactionDate: e.target.value })}
          slotProps={{ htmlInput: { "aria-label": label("Data") } }}
        />
      </TableCell>
      <TableCell>
        <TextField
          fullWidth
          size="small"
          value={draft.description}
          error={!!show(errors.description)}
          helperText={show(errors.description)}
          onChange={(e) => onChange(draft.key, { description: e.target.value })}
          slotProps={{ htmlInput: { "aria-label": label("Descriere") } }}
        />
      </TableCell>
      <TableCell>
        <Select
          fullWidth
          size="small"
          value={draft.type}
          onChange={(e) =>
            onChange(draft.key, { type: e.target.value as TransactionType })
          }
          inputProps={{ "aria-label": label("Tip") }}
        >
          <MenuItem value="EXPENSE">Cheltuială</MenuItem>
          <MenuItem value="INCOME">Venit</MenuItem>
        </Select>
      </TableCell>
      <TableCell>
        <TextField
          select
          fullWidth
          size="small"
          value={draft.categoryId}
          error={!!show(errors.categoryId)}
          helperText={
            draft.aiState === "remembered" ? (
              <Chip
                component="span"
                size="small"
                color="success"
                variant="outlined"
                label="Din alegerile tale"
                sx={{ height: 20 }}
              />
            ) : draft.aiState === "suggested" ? (
              <Chip
                component="span"
                size="small"
                color="primary"
                variant="outlined"
                label="Sugerat de AI"
                sx={{ height: 20 }}
              />
            ) : draft.aiState === "unsure" && included ? (
              "AI-ul nu a știut – alege categoria"
            ) : (
              show(errors.categoryId)
            )
          }
          onChange={(e) => onChange(draft.key, { categoryId: e.target.value })}
          slotProps={{
            select: { displayEmpty: true },
            htmlInput: { "aria-label": label("Categorie") },
          }}
        >
          <MenuItem value="" disabled>
            Alege categoria
          </MenuItem>
          {options.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>
      <TableCell align="right">
        <TextField
          fullWidth
          size="small"
          value={draft.amount}
          error={!!show(errors.amount)}
          helperText={show(errors.amount)}
          onChange={(e) => onChange(draft.key, { amount: e.target.value })}
          slotProps={{
            htmlInput: {
              inputMode: "decimal",
              "aria-label": label("Suma"),
              style: { textAlign: "right" },
            },
          }}
        />
      </TableCell>
    </TableRow>
  );
});
