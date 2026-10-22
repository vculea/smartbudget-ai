import { Box, Button, Card, TablePagination } from "@mui/material";
import { FileUp, Plus, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../../api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { PageHeader } from "../../components/common/PageHeader";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type {
  SortDirection,
  Transaction,
  TransactionQuery,
  TransactionSortField,
} from "../../types";
import { formatCurrency } from "../../utils/format";
import { useCategories } from "../categories/useCategories";
import { useDeleteTransaction, useTransactionsQuery } from "./hooks";
import { TransactionFormDialog } from "./TransactionFormDialog";
import {
  EMPTY_FILTERS,
  TransactionFilters,
  isDateRangeInvalid,
  type TransactionFilterValues,
} from "./TransactionFilters";
import { TransactionsTable } from "./TransactionsTable";

const PAGE_SIZES = [10, 20, 50];

export function TransactionsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] =
    useState<TransactionFilterValues>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<TransactionSortField>("transactionDate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const { categories, byId } = useCategories();
  const debouncedSearch = useDebouncedValue(filters.search);
  const rangeInvalid = isDateRangeInvalid(filters);

  const query = useMemo<TransactionQuery>(
    () => ({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      search: debouncedSearch.trim() || undefined,
      type: filters.type || undefined,
      categoryId: filters.categoryId === "" ? undefined : filters.categoryId,
      startDate: rangeInvalid ? undefined : filters.startDate || undefined,
      endDate: rangeInvalid ? undefined : filters.endDate || undefined,
    }),
    [page, pageSize, sortBy, sortDir, debouncedSearch, filters, rangeInvalid],
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useTransactionsQuery(query);
  const deleteMutation = useDeleteTransaction();

  const handleFiltersChange = (next: TransactionFilterValues) => {
    setFilters(next);
    setPage(0);
  };

  const handleSort = (field: TransactionSortField) => {
    if (field === sortBy) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      setDeleting(null);
      // Dacă s-a șters ultimul element de pe pagină, revenim la pagina anterioară.
      if (data && data.content.length === 1 && page > 0) setPage(page - 1);
    } catch {
      // Eroarea este afișată prin toast din hook.
    }
  };

  const hasActiveFilters =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <>
      <PageHeader
        title="Tranzacții"
        subtitle="Urmărește veniturile și cheltuielile tale."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileUp size={18} />}
              onClick={() => navigate("/transactions/import")}
            >
              Importă CSV / Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={openCreate}
            >
              Adaugă tranzacție
            </Button>
          </>
        }
      />

      <Card sx={{ overflow: "hidden" }}>
        <TransactionFilters
          values={filters}
          categories={categories}
          onChange={handleFiltersChange}
        />
        <Box
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            opacity: isFetching && !isLoading ? 0.6 : 1,
            transition: "opacity .15s",
          }}
        >
          {isLoading ? (
            <Box sx={{ p: 3 }}>
              <LoadingBlock rows={6} />
            </Box>
          ) : isError ? (
            <Box sx={{ p: 3 }}>
              <ErrorState
                message={getErrorMessage(error)}
                onRetry={() => void refetch()}
              />
            </Box>
          ) : data && data.content.length > 0 ? (
            <>
              <TransactionsTable
                transactions={data.content}
                categoriesById={byId}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
              <TablePagination
                component="div"
                count={data.totalElements}
                page={data.page}
                rowsPerPage={pageSize}
                rowsPerPageOptions={PAGE_SIZES}
                labelRowsPerPage="Rânduri pe pagină"
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} din ${count}`
                }
                onPageChange={(_, next) => setPage(next)}
                onRowsPerPageChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
              />
            </>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title={
                hasActiveFilters
                  ? "Nicio tranzacție găsită"
                  : "Nu ai încă nicio tranzacție"
              }
              description={
                hasActiveFilters
                  ? "Încearcă să modifici sau să resetezi filtrele."
                  : "Adaugă prima tranzacție pentru a începe urmărirea finanțelor."
              }
              action={
                hasActiveFilters ? (
                  <Button onClick={() => handleFiltersChange(EMPTY_FILTERS)}>
                    Resetează filtrele
                  </Button>
                ) : (
                  <Button variant="contained" onClick={openCreate}>
                    Adaugă tranzacție
                  </Button>
                )
              }
            />
          )}
        </Box>
      </Card>

      <TransactionFormDialog
        open={formOpen}
        transaction={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Ștergi tranzacția?"
        description={
          deleting
            ? `Tranzacția „${deleting.description}” în valoare de ${formatCurrency(deleting.amount)} va fi ștearsă definitiv.`
            : ""
        }
        loading={deleteMutation.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
