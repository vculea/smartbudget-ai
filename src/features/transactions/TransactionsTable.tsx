import {
  Box,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import { Pencil, Trash2 } from "lucide-react";
import type {
  Category,
  SortDirection,
  Transaction,
  TransactionSortField,
} from "../../types";
import { formatDate } from "../../utils/date";
import { TransactionAmount } from "./TransactionAmount";

interface TransactionsTableProps {
  transactions: Transaction[];
  categoriesById: Map<number, Category>;
  sortBy: TransactionSortField;
  sortDir: SortDirection;
  onSort: (field: TransactionSortField) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionsTable({
  transactions,
  categoriesById,
  sortBy,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: TransactionsTableProps) {
  const sortProps = (field: TransactionSortField) => ({
    active: sortBy === field,
    direction: sortBy === field ? sortDir : ("desc" as const),
    onClick: () => onSort(field),
  });

  return (
    <TableContainer>
      <Table aria-label="Lista tranzacțiilor" size="medium">
        <TableHead>
          <TableRow>
            <TableCell
              sortDirection={sortBy === "transactionDate" ? sortDir : false}
            >
              <TableSortLabel {...sortProps("transactionDate")}>
                Data
              </TableSortLabel>
            </TableCell>
            <TableCell>Descriere</TableCell>
            <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
              Categorie
            </TableCell>
            <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
              Tip
            </TableCell>
            <TableCell
              align="right"
              sortDirection={sortBy === "amount" ? sortDir : false}
            >
              <TableSortLabel {...sortProps("amount")}>Sumă</TableSortLabel>
            </TableCell>
            <TableCell align="right">
              <Box component="span" sx={visuallyHidden}>
                Acțiuni
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((tx) => {
            const category = categoriesById.get(tx.categoryId);
            const categoryName = category?.name ?? tx.categoryName ?? "—";
            return (
              <TableRow key={tx.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {formatDate(tx.transactionDate)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {tx.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { sm: "none" } }}
                  >
                    {categoryName}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      aria-hidden
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: category?.color ?? "grey.400",
                      }}
                    />
                    <span>{categoryName}</span>
                  </Stack>
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={tx.type === "INCOME" ? "success" : "default"}
                    label={tx.type === "INCOME" ? "Venit" : "Cheltuială"}
                  />
                </TableCell>
                <TableCell align="right">
                  <TransactionAmount type={tx.type} amount={tx.amount} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Editează">
                    <IconButton
                      size="small"
                      aria-label={`Editează ${tx.description}`}
                      onClick={() => onEdit(tx)}
                    >
                      <Pencil size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Șterge">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Șterge ${tx.description}`}
                      onClick={() => onDelete(tx)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
} as const;
