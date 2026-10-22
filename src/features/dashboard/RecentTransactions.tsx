import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { ReceiptText } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { SectionCard } from "../../components/common/SectionCard";
import type { Category, Transaction } from "../../types";
import { formatDate } from "../../utils/date";
import { TransactionAmount } from "../transactions/TransactionAmount";

interface RecentTransactionsProps {
  transactions: Transaction[];
  categoriesById: Map<string, Category>;
}

export function RecentTransactions({
  transactions,
  categoriesById,
}: RecentTransactionsProps) {
  return (
    <SectionCard
      title="Ultimele tranzacții"
      action={
        <Button component={Link} to="/transactions" size="small">
          Vezi toate
        </Button>
      }
    >
      {transactions.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Nicio tranzacție în această lună"
        />
      ) : (
        <Stack component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
          {transactions.map((tx, index) => {
            const category = categoriesById.get(tx.categoryId);
            return (
              <Fragment key={tx.id}>
                {index > 0 && <Divider component="li" />}
                <Stack
                  component="li"
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={2}
                  sx={{ py: 1.5 }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ minWidth: 0 }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: category?.color ?? "grey.400",
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                        noWrap
                      >
                        {tx.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {category?.name ?? tx.categoryName ?? "—"} ·{" "}
                        {formatDate(tx.transactionDate)}
                      </Typography>
                    </Box>
                  </Stack>
                  <TransactionAmount type={tx.type} amount={tx.amount} />
                </Stack>
              </Fragment>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}
