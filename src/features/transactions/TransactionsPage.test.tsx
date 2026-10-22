import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { TransactionsPage } from "./TransactionsPage";

const findTable = () =>
  screen.findByRole(
    "table",
    { name: "Lista tranzacțiilor" },
    { timeout: 3000 },
  );
const totalLabel = () => screen.getByText(/din \d+/).textContent;

describe("TransactionsPage", () => {
  it("afișează tranzacțiile din API-ul demo, paginat", async () => {
    renderWithProviders(<TransactionsPage />);
    const table = await findTable();
    // 1 rând de antet + 10 rânduri pe pagină
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(totalLabel()).toMatch(/^1–10 din \d+$/);
  });

  it("validează câmpurile obligatorii la adăugare", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await findTable();

    await user.click(screen.getByRole("button", { name: "Adaugă tranzacție" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Tranzacție nouă",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Adaugă tranzacția" }),
    );

    expect(await within(dialog).findByText("Introdu suma")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Descrierea este obligatoriu"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Selectează o categorie"),
    ).toBeInTheDocument();
  });

  it("adaugă o tranzacție nouă și o afișează în listă", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await findTable();

    await user.click(screen.getByRole("button", { name: "Adaugă tranzacție" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Tranzacție nouă",
    });

    await user.type(
      within(dialog).getByRole("textbox", { name: /Sumă/ }),
      "123,45",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /Descriere/ }),
      "Cadou pentru test",
    );
    await user.click(
      within(dialog).getByRole("combobox", { name: /Categorie/ }),
    );
    await user.click(await screen.findByRole("option", { name: "Alimente" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Adaugă tranzacția" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Cadou pentru test")).toBeInTheDocument();
  });

  it("completează formularul dintr-o poză și permite modificarea înainte de salvare", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await findTable();

    await user.click(screen.getByRole("button", { name: "Adaugă tranzacție" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Tranzacție nouă",
    });

    await user.upload(
      within(dialog).getByTestId("receipt-input"),
      new File(["x"], "bon.jpg", { type: "image/jpeg" }),
    );

    await waitFor(
      () =>
        expect(
          within(dialog).getByRole("textbox", { name: /Sumă/ }),
        ).toHaveValue("87.5"),
      { timeout: 5000 },
    );
    expect(
      within(dialog).getByRole("textbox", { name: /Descriere/ }),
    ).toHaveValue("Bon exemplu (mod demo) - cumpărături");
    expect(
      within(dialog).getByRole("combobox", { name: /Categorie/ }),
    ).toHaveTextContent("Alimente");
    expect(
      within(dialog).getByText(/Am completat câmpurile din poză/),
    ).toBeInTheDocument();

    const description = within(dialog).getByRole("textbox", {
      name: /Descriere/,
    });
    await user.clear(description);
    await user.type(description, "Bon scanat corectat");
    await user.click(
      within(dialog).getByRole("button", { name: "Adaugă tranzacția" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Bon scanat corectat")).toBeInTheDocument();
  });

  it("cere confirmare înainte de ștergere și elimină tranzacția", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    const table = await findTable();

    const firstRow = within(table).getAllByRole("row")[1] as HTMLElement;
    const totalBefore = totalLabel();

    await user.click(
      within(firstRow).getByRole("button", { name: /^Șterge / }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Ștergi tranzacția?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Șterge" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(totalLabel()).not.toBe(totalBefore));
  });

  it("filtrează după descriere", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await findTable();

    await user.type(
      screen.getByRole("textbox", { name: "Caută după descriere" }),
      "netflix",
    );

    await waitFor(() => {
      const rows = within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((row) => expect(row).toHaveTextContent("Netflix"));
    });
  });

  it("afișează empty state când nu există rezultate", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await findTable();

    await user.type(
      screen.getByRole("textbox", { name: "Caută după descriere" }),
      "zzzzzz",
    );
    expect(
      await screen.findByText("Nicio tranzacție găsită"),
    ).toBeInTheDocument();
  });
});
