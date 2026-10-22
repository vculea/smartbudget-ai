import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAiSettings } from "../../config/aiSettings";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AiSettingsPage } from "./AiSettingsPage";

afterEach(() => vi.unstubAllGlobals());

describe("AiSettingsPage", () => {
  it("pornește pe serverul aplicației și ascunde setările locale", () => {
    renderWithProviders(<AiSettingsPage />);

    expect(
      screen.getByRole("radio", { name: /Serverul aplicației/ }),
    ).toBeChecked();
    expect(screen.queryByLabelText("Adresa serverului AI")).toBeNull();
  });

  it("salvează modul local cu modelele alese", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Model local/ }));
    const model = screen.getByLabelText("Model pentru recomandări");
    await user.clear(model);
    await user.type(model, "qwen2.5:7b");
    await user.click(screen.getByRole("button", { name: "Salvează setările" }));

    expect(loadAiSettings().mode).toBe("local");
    expect(loadAiSettings().local.model).toBe("qwen2.5:7b");
  });

  it("salvează cheia proprie pentru furnizorul ales", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Cheia mea API/ }));
    const save = screen.getByRole("button", { name: "Salvează setările" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Cheia API"), "sk-abc");
    expect(save).toBeEnabled();
    await user.click(save);

    expect(loadAiSettings().mode).toBe("own-key");
    expect(loadAiSettings().ownKey).toMatchObject({
      provider: "openai",
      apiKey: "sk-abc",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("schimbă adresa și modelele când alegi alt furnizor", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Cheia mea API/ }));
    await user.click(screen.getByRole("combobox", { name: "Furnizor" }));
    await user.click(await screen.findByRole("option", { name: "Groq" }));

    expect(screen.getByLabelText("Adresa serverului AI")).toHaveValue(
      "https://api.groq.com/openai/v1",
    );
  });

  it("nu permite o adresă HTTP pentru cheia proprie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Cheia mea API/ }));
    await user.type(screen.getByLabelText("Cheia API"), "sk-abc");
    const url = screen.getByLabelText("Adresa serverului AI");
    await user.clear(url);
    await user.type(url, "http://api.exemplu.ro/v1");

    expect(screen.getByText(/cheia ar circula necriptat/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvează setările" }),
    ).toBeDisabled();
  });

  it("nu permite salvarea cu o adresă invalidă", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Model local/ }));
    const url = screen.getByLabelText("Adresa serverului AI");
    await user.clear(url);
    await user.type(url, "localhost");

    expect(
      screen.getByRole("button", { name: "Salvează setările" }),
    ).toBeDisabled();
  });

  it("testează conexiunea și semnalează modelele lipsă", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "llama3.1:8b" }] }))),
    );
    const user = userEvent.setup();
    renderWithProviders(<AiSettingsPage />);

    await user.click(screen.getByRole("radio", { name: /Model local/ }));
    await user.click(
      screen.getByRole("button", { name: "Testează conexiunea" }),
    );

    expect(await screen.findByText(/Conexiune reușită/)).toBeInTheDocument();
    expect(screen.getByText(/Nu au fost găsite: gemma4:26b/)).toBeInTheDocument();
  });
});
