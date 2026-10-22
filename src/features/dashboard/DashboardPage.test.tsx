import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AppRoutes } from "../../app/AppRoutes";

describe("Dashboard", () => {
  it("afișează indicatorii lunii din API-ul demo și permite navigarea", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });

    expect(
      await screen.findByText("Venituri", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cheltuieli")).toBeInTheDocument();
    expect(screen.getByText("Sold lunar")).toBeInTheDocument();
    expect(screen.getByText("Rata de economisire")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Tranzacții" }));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Tranzacții", level: 1 },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it("reîncarcă datele la schimbarea lunii", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });
    await screen.findByText("Sold lunar", {}, { timeout: 5000 });

    await user.click(screen.getByRole("button", { name: "Luna anterioară" }));
    expect(await screen.findByText("Sold lunar")).toBeInTheDocument();
  });

  it("permite selectarea unui an întreg", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });
    await screen.findByText("Sold lunar", {}, { timeout: 5000 });

    await user.click(screen.getByRole("combobox", { name: "Selectează perioada" }));
    const yearOption = (await screen.findAllByRole("option")).find((o) =>
      /^Anul \d{4}$/.test(o.textContent ?? ""),
    );
    expect(yearOption).toBeDefined();
    await user.click(yearOption!);

    expect(
      await screen.findByText("Sold anual", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anul anterior" }),
    ).toBeInTheDocument();
  });
});
