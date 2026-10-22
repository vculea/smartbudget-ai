import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AiInsightsPage } from "./AiInsightsPage";

describe("AiInsightsPage", () => {
  it("rulează analiza și afișează recomandările", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiInsightsPage />);

    await user.click(
      screen.getByRole("button", { name: "Analizează situația mea" }),
    );

    expect(
      await screen.findByText("Rezumatul situației tale"),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Economie lunară estimată/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/nu sunt\s+garanții/)).toBeInTheDocument();
  });

  it("transformă o recomandare în obiectiv", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiInsightsPage />);

    await user.click(
      screen.getByRole("button", { name: "Analizează situația mea" }),
    );
    const [convert] = await screen.findAllByRole("button", {
      name: /Transformă în obiectiv/,
    });
    await user.click(convert as HTMLElement);

    const dialog = await screen.findByRole("dialog", {
      name: "Obiectiv nou de economisire",
    });
    const nameInput = within(dialog).getByRole<HTMLInputElement>("textbox", {
      name: /Nume obiectiv/,
    });
    expect(nameInput.value).toContain("Economii:");
    await user.click(
      within(dialog).getByRole("button", { name: "Creează obiectivul" }),
    );

    expect(
      await screen.findByRole("button", { name: "Obiectiv creat" }),
    ).toBeDisabled();
  });
});
