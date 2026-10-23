import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "../../api";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingBlock } from "../../components/common/LoadingBlock";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import type { Category, TransactionType } from "../../types";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import { RememberedMerchantsCard } from "./RememberedMerchantsCard";
import { useCategories } from "./useCategories";

const SECTIONS: { type: TransactionType; title: string; empty: string }[] = [
  {
    type: "EXPENSE",
    title: "Cheltuieli",
    empty: "Nu ai nicio categorie de cheltuieli.",
  },
  {
    type: "INCOME",
    title: "Venituri",
    empty: "Nu ai nicio categorie de venituri.",
  },
];

type FormState = {
  open: boolean;
  category: Category | null;
  type: TransactionType;
};

export function CategoriesPage() {
  const { categories, byId, isLoading, isError, error, refetch } =
    useCategories();
  const [form, setForm] = useState<FormState>({
    open: false,
    category: null,
    type: "EXPENSE",
  });
  const [deleting, setDeleting] = useState<Category | null>(null);

  const openNew = (type: TransactionType) =>
    setForm({ open: true, category: null, type });

  return (
    <>
      <PageHeader
        title="Categorii"
        subtitle="Organizează-ți veniturile și cheltuielile cum vrei: adaugă, redenumește sau șterge categorii."
        actions={
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => openNew("EXPENSE")}
            sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Categorie nouă
          </Button>
        }
      />

      {isLoading ? (
        <LoadingBlock rows={2} height={220} />
      ) : isError ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
            alignItems: "start",
          }}
        >
          {SECTIONS.map((section) => {
            const items = categories
              .filter((c) => c.type === section.type)
              .sort((a, b) => a.name.localeCompare(b.name, "ro"));
            return (
              <SectionCard
                key={section.type}
                title={section.title}
                subtitle={
                  items.length === 1 ? "1 categorie" : `${items.length} categorii`
                }
                action={
                  <Button
                    size="small"
                    startIcon={<Plus size={16} />}
                    onClick={() => openNew(section.type)}
                    aria-label={`Adaugă categorie de ${section.title.toLowerCase()}`}
                  >
                    Adaugă
                  </Button>
                }
                flush
              >
                {items.length === 0 ? (
                  <Stack
                    alignItems="center"
                    spacing={1}
                    sx={{ py: 4, color: "text.secondary" }}
                  >
                    <Tags size={24} aria-hidden />
                    <Typography variant="body2">{section.empty}</Typography>
                  </Stack>
                ) : (
                  <List dense aria-label={`Categorii de ${section.title.toLowerCase()}`}>
                    {items.map((category) => (
                      <ListItem
                        key={category.id}
                        divider
                        sx={{ px: 3 }}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Editează">
                              <IconButton
                                size="small"
                                aria-label={`Editează ${category.name}`}
                                onClick={() =>
                                  setForm({
                                    open: true,
                                    category,
                                    type: category.type,
                                  })
                                }
                              >
                                <Pencil size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Șterge">
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Șterge ${category.name}`}
                                onClick={() => setDeleting(category)}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                      >
                        <Box
                          aria-hidden
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            mr: 1.5,
                            flexShrink: 0,
                            bgcolor: category.color ?? "grey.400",
                          }}
                        />
                        <ListItemText primary={category.name} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </SectionCard>
            );
          })}
          <Box sx={{ gridColumn: "1 / -1" }}>
            <RememberedMerchantsCard categoriesById={byId} />
          </Box>
        </Box>
      )}

      <CategoryFormDialog
        open={form.open}
        category={form.category}
        defaultType={form.type}
        onClose={() => setForm((current) => ({ ...current, open: false }))}
      />
      <DeleteCategoryDialog
        category={deleting}
        categories={categories}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
