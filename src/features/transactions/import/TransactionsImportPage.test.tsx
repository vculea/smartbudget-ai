import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { TransactionsPage } from "../TransactionsPage";
import { TransactionsImportPage } from "./TransactionsImportPage";

const CSV = [
  "Data;Descriere;Suma;Categorie",
  "01.01.2030;Import test salariu;5000;Salariu",
  "02.01.2030;Import test cafea;-12,5;Alimente",
  "03.01.2030;Import test fara categorie;-30;",
].join("\n");

const renderImport = () =>
  renderWithProviders(
    <Routes>
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/transactions/import" element={<TransactionsImportPage />} />
    </Routes>,
    { route: "/transactions/import" },
  );

describe("TransactionsImportPage", () => {
  it("afișează previzualizarea, cere corectarea rândurilor invalide și apoi salvează", async () => {
    const user = userEvent.setup();
    renderImport();

    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File([CSV], "extras.csv", { type: "text/csv" }),
    );

    const table = await screen.findByRole(
      "table",
      { name: "Previzualizare import" },
      { timeout: 3000 },
    );
    // antet + 3 rânduri
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(
      within(table).getByRole("textbox", { name: "Descriere rând 3" }),
    ).toHaveValue("Import test cafea");
    expect(within(table).getByRole("textbox", { name: "Suma rând 3" })).toHaveValue(
      "12.5",
    );

    const save = screen.getByRole("button", { name: "Adaugă 3 tranzacții" });
    expect(save).toBeDisabled();
    expect(await screen.findByText("1 rânduri de corectat")).toBeInTheDocument();
    expect(
      await screen.findByText("AI-ul nu a știut – alege categoria"),
    ).toBeInTheDocument();

    await user.click(
      within(table).getByRole("combobox", { name: "Categorie rând 4" }),
    );
    await user.click(await screen.findByRole("option", { name: "Transport" }));

    const add = screen.getByRole("button", { name: "Adaugă 3 tranzacții" });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    expect(
      await screen.findByRole(
        "table",
        { name: "Lista tranzacțiilor" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Import test salariu")).toBeInTheDocument();
    expect(screen.getByText("Import test fara categorie")).toBeInTheDocument();
  });

  it("permite debifarea rândurilor invalide", async () => {
    const user = userEvent.setup();
    renderImport();
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File([CSV], "extras.csv", { type: "text/csv" }),
    );
    await screen.findByRole("table", { name: "Previzualizare import" });

    await user.click(screen.getByRole("checkbox", { name: "Include rând 4" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Adaugă 2 tranzacții" }),
      ).toBeEnabled(),
    );
  });

  it("completează categoriile cu AI și marchează ce nu a știut", async () => {
    const user = userEvent.setup();
    renderImport();
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File(
        [
          "Data;Descriere;Suma\n01.01.2030;MEGA IMAGE 123;-50\n02.01.2030;Plata XYZ 987;-20",
        ],
        "extras.csv",
        { type: "text/csv" },
      ),
    );
    const table = await screen.findByRole("table", {
      name: "Previzualizare import",
    });

    await waitFor(() =>
      expect(
        within(table).getByRole("combobox", { name: "Categorie rând 2" }),
      ).toHaveTextContent("Alimente"),
    );
    expect(await screen.findByText("Sugerat de AI")).toBeInTheDocument();
    expect(
      screen.getByText("AI-ul nu a știut – alege categoria"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Adaugă 2 tranzacții" }),
    ).toBeDisabled();
  });

  it("afișează o eroare clară pentru un fișier fără coloanele necesare", async () => {
    const user = userEvent.setup();
    renderImport();
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File(["a,b\n1,2"], "gresit.csv", { type: "text/csv" }),
    );
    expect(
      await screen.findByText(/Nu am putut recunoaște coloanele/),
    ).toBeInTheDocument();
  });
});
