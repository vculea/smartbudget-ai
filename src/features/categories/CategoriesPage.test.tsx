import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { loadDb } from "../../mocks/db";
import { learnMemory } from "../../mocks/categoryMemory";
import { CATEGORY } from "../../mocks/seed";
import { renderWithProviders } from "../../test/renderWithProviders";
import { CategoriesPage } from "./CategoriesPage";

const expenseList = () =>
  screen.findByRole("list", { name: "Categorii de cheltuieli" });

describe("CategoriesPage", () => {
  it("adaugă o categorie nouă de venituri", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    await expenseList();

    await user.click(
      screen.getByRole("button", { name: "Adaugă categorie de venituri" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Categorie nouă",
    });
    expect(within(dialog).getByRole("radio", { name: "Venit" })).toBeChecked();
    await user.type(
      within(dialog).getByRole("textbox", { name: /Nume categorie/ }),
      "Chirii încasate",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Adaugă categoria" }),
    );

    const incomes = await screen.findByRole("list", {
      name: "Categorii de venituri",
    });
    expect(
      await within(incomes).findByText("Chirii încasate"),
    ).toBeInTheDocument();
    expect(
      loadDb().categories.find((c) => c.name === "Chirii încasate")?.type,
    ).toBe("INCOME");
  });

  it("redenumește o categorie și respinge un nume duplicat", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    const list = await expenseList();

    await user.click(
      within(list).getByRole("button", { name: "Editează Shopping" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editează categoria",
    });
    const name = within(dialog).getByRole("textbox", { name: /Nume categorie/ });
    await user.clear(name);
    await user.type(name, "alimente");
    await user.click(within(dialog).getByRole("button", { name: "Salvează" }));
    expect(
      await within(dialog).findByText(/Ai deja o categorie/),
    ).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Haine");
    await user.click(within(dialog).getByRole("button", { name: "Salvează" }));

    expect(await within(list).findByText("Haine")).toBeInTheDocument();
    expect(within(list).queryByText("Shopping")).not.toBeInTheDocument();
  });

  it("arată categoriile învățate și permite uitarea lor", async () => {
    learnMemory(loadDb(), [
      {
        description: "GLOVO 123",
        type: "EXPENSE",
        categoryId: CATEGORY.restaurants,
        corrected: true,
      },
      {
        description: "Lidl Cluj",
        type: "EXPENSE",
        categoryId: CATEGORY.groceries,
        corrected: false,
      },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);

    const list = await screen.findByRole("list", { name: "Categorii învățate" });
    expect(within(list).getByText("glovo")).toBeInTheDocument();
    expect(within(list).getByText("Restaurante · o tranzacție")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Uită glovo" }));
    await waitFor(() =>
      expect(within(list).queryByText("glovo")).not.toBeInTheDocument(),
    );
    expect(within(list).getByText("lidl cluj")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Uită tot" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Uiți toate categoriile învățate?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Uită tot" }));
    expect(await screen.findByText(/Încă nu am învățat nimic/)).toBeInTheDocument();
  });

  it("mută tranzacțiile în altă categorie înainte de ștergere", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesPage />);
    const list = await expenseList();
    expect(
      loadDb().transactions.some(
        (t) => t.categoryId === CATEGORY.subscriptions,
      ),
    ).toBe(true);

    await user.click(
      within(list).getByRole("button", { name: "Șterge Abonamente" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Ștergi categoria?",
    });
    expect(await within(dialog).findByText(/Alege/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", {
      name: "Mută și șterge",
    });
    expect(confirm).toBeDisabled();

    await user.click(
      within(dialog).getByRole("combobox", { name: /Mută în categoria/ }),
    );
    await user.click(await screen.findByRole("option", { name: "Divertisment" }));
    await user.click(confirm);

    await waitFor(() =>
      expect(within(list).queryByText("Abonamente")).not.toBeInTheDocument(),
    );
    const db = loadDb();
    expect(
      db.transactions.some((t) => t.categoryId === CATEGORY.subscriptions),
    ).toBe(false);
    expect(
      db.budgets.some((b) => b.categoryId === CATEGORY.subscriptions),
    ).toBe(false);
  });
});
