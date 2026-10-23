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
    expect(
      within(table).getByRole("textbox", { name: "Suma rând 3" }),
    ).toHaveValue("12.5");

    const save = screen.getByRole("button", { name: "Adaugă 3 tranzacții" });
    expect(save).toBeDisabled();
    expect(
      await screen.findByText("1 rânduri de corectat"),
    ).toBeInTheDocument();
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

  it("debifează rândurile care există deja când același fișier e importat din nou", async () => {
    const user = userEvent.setup();
    const file = () =>
      new File(
        [
          "Data;Descriere;Suma;Categorie\n05.01.2030;Dublura salariu;5000;Salariu\n06.01.2030;Dublura cafea;-12,5;Alimente",
        ],
        "extras.csv",
        { type: "text/csv" },
      );
    const first = renderImport();
    await user.upload(screen.getByLabelText("Fișier de importat"), file());
    const add = await screen.findByRole("button", {
      name: "Adaugă 2 tranzacții",
    });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);
    expect(
      await screen.findByText("Dublura salariu", undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    first.unmount();

    renderImport();
    await user.upload(screen.getByLabelText("Fișier de importat"), file());

    expect(
      await screen.findByText(/2 rânduri există deja în aplicație/, undefined, {
        timeout: 3000,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Există deja")).toHaveLength(2);
    expect(
      screen.getByRole("checkbox", { name: "Include rând 2" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Include rând 3" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Adaugă 0 tranzacții" }),
    ).toBeDisabled();
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

  it("permite retrimiterea la AI a rândurilor fără categorie", async () => {
    const user = userEvent.setup();
    renderImport();
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File(
        ["Data;Descriere;Suma\n01.01.2030;Plata XYZ 987;-20"],
        "extras.csv",
        {
          type: "text/csv",
        },
      ),
    );
    await screen.findByText("AI-ul nu a știut – alege categoria");

    const improve = screen.getByRole("button", {
      name: "Îmbunătățește răspunsul",
    });
    await waitFor(() => expect(improve).toBeEnabled());
    await user.click(improve);

    expect(
      await screen.findByText("AI-ul nu a știut – alege categoria"),
    ).toBeInTheDocument();
    await waitFor(() => expect(improve).toBeEnabled());
  });

  it("reține categoria corectată și o completează singură la importul următor", async () => {
    const user = userEvent.setup();
    const file = (day = "01") =>
      new File(
        [`Data;Descriere;Suma\n${day}.01.2030;MEGA IMAGE 123 CLUJ;-50`],
        "extras.csv",
        { type: "text/csv" },
      );
    const first = renderImport();
    await user.upload(screen.getByLabelText("Fișier de importat"), file());
    const table = await screen.findByRole("table", {
      name: "Previzualizare import",
    });
    const category = within(table).getByRole("combobox", {
      name: "Categorie rând 2",
    });
    await waitFor(() => expect(category).toHaveTextContent("Alimente"));

    await user.click(category);
    await user.click(
      await screen.findByRole("option", { name: "Restaurante" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Adaugă 1 tranzacție" }),
    );
    await screen.findByRole(
      "table",
      { name: "Lista tranzacțiilor" },
      { timeout: 3000 },
    );
    first.unmount();

    renderImport();
    // altă zi: aceeași descriere, dar o tranzacție nouă (nu o dublură)
    await user.upload(screen.getByLabelText("Fișier de importat"), file("08"));
    const again = await screen.findByRole("table", {
      name: "Previzualizare import",
    });
    await waitFor(() =>
      expect(
        within(again).getByRole("combobox", { name: "Categorie rând 2" }),
      ).toHaveTextContent("Restaurante"),
    );
    expect(screen.getByText("Din alegerile tale")).toBeInTheDocument();
    expect(screen.queryByText("Sugerat de AI")).not.toBeInTheDocument();
    expect(screen.getByText(/Categorii reținute: 1/)).toBeInTheDocument();
  });

  it("pune categoria aleasă și pe rândurile cu aceeași descriere", async () => {
    const user = userEvent.setup();
    renderImport();
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File(
        [
          "Data;Descriere;Suma\n01.01.2030;Plata XYZ 987;-20\n02.01.2030;plata xyz 987;-30\n03.01.2030;Altceva QQ;-5",
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
        screen.getAllByText("AI-ul nu a știut – alege categoria"),
      ).toHaveLength(3),
    );

    await user.click(
      within(table).getByRole("combobox", { name: "Categorie rând 2" }),
    );
    await user.click(await screen.findByRole("option", { name: "Transport" }));

    expect(
      within(table).getByRole("combobox", { name: "Categorie rând 3" }),
    ).toHaveTextContent("Transport");
    expect(
      within(table).getByRole("combobox", { name: "Categorie rând 4" }),
    ).not.toHaveTextContent("Transport");
    expect(
      screen.getByText(
        "Am pus aceeași categorie și la încă un rând cu aceeași descriere.",
      ),
    ).toBeInTheDocument();
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

  it("permite alegerea manuală a coloanelor, cu descriere implicită", async () => {
    const user = userEvent.setup();
    renderImport();
    const schedule = [
      "Tranzacții;;",
      "Data rambursarii;Suma achitata;Dobanda",
      "17.10.2030;5883;0",
      "16.10.2030;0;0",
      "15.10.2030;1820,23;839,82",
    ].join("\n");
    await user.upload(
      screen.getByLabelText("Fișier de importat"),
      new File([schedule], "credit.csv", { type: "text/csv" }),
    );

    await user.click(
      await screen.findByRole("combobox", { name: /Coloana cu data/ }),
    );
    await user.click(
      await screen.findByRole("option", { name: /Data rambursarii/ }),
    );
    await user.click(screen.getByRole("combobox", { name: /Coloana cu suma/ }));
    await user.click(
      await screen.findByRole("option", { name: /Suma achitata/ }),
    );
    await user.type(
      screen.getByLabelText(/Descrierea tranzacțiilor/),
      "Rată credit",
    );
    await user.click(screen.getByRole("button", { name: "Continuă" }));

    const table = await screen.findByRole(
      "table",
      { name: "Previzualizare import" },
      { timeout: 3000 },
    );
    // antet + 2 rânduri (suma 0 e omisă)
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(
      within(table).getByRole("textbox", { name: "Descriere rând 3" }),
    ).toHaveValue("Rată credit");
  });
});
