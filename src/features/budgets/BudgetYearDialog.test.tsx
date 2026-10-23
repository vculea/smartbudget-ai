import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { budgetsApi } from "../../api";
import { renderWithProviders } from "../../test/renderWithProviders";
import { currentMonth } from "../../utils/date";
import { BudgetYearDialog } from "./BudgetYearDialog";

const nextYear = Number(currentMonth().slice(0, 4)) + 1;

describe("BudgetYearDialog", () => {
  it("completează limitele cu AI și creează bugetele pe lunile alese", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <BudgetYearDialog open year={nextYear} onClose={onClose} />,
    );
    const dialog = await screen.findByRole("dialog", {
      name: `Buget anual · ${nextYear}`,
    });

    await user.click(
      within(dialog).getByRole("button", { name: "Propune cu AI" }),
    );
    expect(
      await within(dialog).findByText(/Propunere pe baza mediilor lunare/),
    ).toBeInTheDocument();
    const filledLimits = within(dialog)
      .getAllByRole<HTMLInputElement>("textbox", { name: /Limită lunară/ })
      .filter((input) => input.value !== "");
    const filledIncomes = within(dialog)
      .getAllByRole<HTMLInputElement>("textbox", { name: /Venit lunar așteptat/ })
      .filter((input) => input.value !== "");
    expect(filledLimits.length).toBeGreaterThan(0);
    expect(filledIncomes.length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Medie \d{4}:/).length).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole("group", { name: "Rezumat buget" }),
    ).toHaveTextContent(/Sold planificat/);

    // Doar ianuarie și februarie.
    await user.click(within(dialog).getByRole("button", { name: "Deselectează tot" }));
    await user.click(within(dialog).getByRole("button", { name: "Ian" }));
    await user.click(within(dialog).getByRole("button", { name: "Feb" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Creează bugetele" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Limitele apar la bugete, veniturile separat, ca venituri planificate.
    expect(await budgetsApi.list(`${nextYear}-02`)).toHaveLength(
      filledLimits.length,
    );
    const incomes = await budgetsApi.listIncome(`${nextYear}-02`);
    expect(incomes).toHaveLength(filledIncomes.length);
    expect(incomes[0]?.status).toBe("PENDING");
    expect(await budgetsApi.list(`${nextYear}-03`)).toHaveLength(0);
  });

  it("validează sumele introduse manual", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BudgetYearDialog open year={nextYear} onClose={() => {}} />,
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: "Creează bugetele" }),
    );
    expect(
      within(dialog).getByText("Completează suma pentru cel puțin o categorie."),
    ).toBeInTheDocument();

    const [first] = await within(dialog).findAllByRole("textbox", {
      name: /Limită lunară/,
    });
    await user.type(first as HTMLElement, "abc");
    await user.click(
      within(dialog).getByRole("button", { name: "Creează bugetele" }),
    );
    expect(
      within(dialog).getByText("Introdu o sumă validă (maxim 2 zecimale)"),
    ).toBeInTheDocument();
  });
});
