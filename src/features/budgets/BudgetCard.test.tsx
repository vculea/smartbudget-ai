import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import type { Budget } from "../../types";
import { BudgetCard } from "./BudgetCard";

const base: Budget = {
  id: "1",
  categoryId: "1",
  categoryName: "Alimente",
  month: "2026-10",
  limitAmount: 1000,
  spentAmount: 500,
  remainingAmount: 500,
  percentageUsed: 50,
  status: "NORMAL",
};

describe("BudgetCard", () => {
  it("nu afișează avertizare sub 80%", () => {
    renderWithProviders(<BudgetCard budget={base} />);
    expect(screen.getByText("În limită")).toBeInTheDocument();
    expect(screen.queryByText(/peste 80%/)).not.toBeInTheDocument();
  });

  it("avertizează la 80%", () => {
    renderWithProviders(
      <BudgetCard
        budget={{
          ...base,
          spentAmount: 850,
          remainingAmount: 150,
          percentageUsed: 85,
          status: "WARNING",
        }}
      />,
    );
    expect(screen.getByText("Aproape de limită")).toBeInTheDocument();
    expect(screen.getByText(/peste 80% din buget/)).toBeInTheDocument();
  });

  it("semnalează depășirea limitei", () => {
    renderWithProviders(
      <BudgetCard
        budget={{
          ...base,
          spentAmount: 1200,
          remainingAmount: -200,
          percentageUsed: 120,
          status: "EXCEEDED",
        }}
      />,
    );
    expect(screen.getByText("Limită depășită")).toBeInTheDocument();
    expect(screen.getByText(/Depășit cu/)).toBeInTheDocument();
  });
});
