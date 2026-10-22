import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { GoalsPage } from "./GoalsPage";

describe("GoalsPage", () => {
  it("actualizează progresul după o contribuție", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GoalsPage />);

    const card = await screen.findByRole("article", {
      name: "Obiectiv Fond de urgență",
    });
    expect(within(card).getByText(/9\.200,00/)).toBeInTheDocument();

    await user.click(
      within(card).getByRole("button", { name: /Adaugă contribuție/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Adaugă contribuție",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: /Sumă contribuție/ }),
      "800",
    );
    await user.click(within(dialog).getByRole("button", { name: "Adaugă" }));

    const updated = await screen.findByText(/10\.000,00/);
    expect(updated).toBeInTheDocument();
  });

  it("respinge o contribuție invalidă", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GoalsPage />);

    const card = await screen.findByRole("article", {
      name: "Obiectiv Fond de urgență",
    });
    await user.click(
      within(card).getByRole("button", { name: /Adaugă contribuție/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Adaugă contribuție",
    });
    await user.type(
      within(dialog).getByRole("textbox", { name: /Sumă contribuție/ }),
      "-10",
    );
    await user.click(within(dialog).getByRole("button", { name: "Adaugă" }));

    expect(await within(dialog).findByText(/sumă validă/)).toBeInTheDocument();
  });
});
