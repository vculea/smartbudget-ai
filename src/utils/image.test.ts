import { describe, expect, it, vi } from "vitest";
import { prepareImageForUpload } from "./image";

const renderPdfFirstPage = vi.hoisted(() => vi.fn());
vi.mock("./pdf", () => ({ renderPdfFirstPage }));

describe("prepareImageForUpload", () => {
  it("randează PDF-urile ca imagine", async () => {
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    renderPdfFirstPage.mockResolvedValue(jpeg);
    const pdf = new File(["%PDF"], "factura.pdf", { type: "application/pdf" });

    await expect(prepareImageForUpload(pdf)).resolves.toBe(jpeg);
    expect(renderPdfFirstPage).toHaveBeenCalledWith(pdf);
  });

  it("recunoaște PDF-ul după extensie când tipul lipsește", async () => {
    const jpeg = new Blob(["jpeg"], { type: "image/jpeg" });
    renderPdfFirstPage.mockResolvedValue(jpeg);

    await expect(
      prepareImageForUpload(new File(["%PDF"], "bon.PDF")),
    ).resolves.toBe(jpeg);
  });

  it("respinge fișierele care nu sunt imagini sau PDF", async () => {
    await expect(
      prepareImageForUpload(new File(["x"], "note.txt", { type: "text/plain" })),
    ).rejects.toThrow(/nu este acceptat/);
  });

  it("nu trimite formate neacceptate de model când browserul nu le poate converti", async () => {
    await expect(
      prepareImageForUpload(new File(["x"], "bon.heic", { type: "image/heic" })),
    ).rejects.toThrow(/nu poate fi citit/);
  });

  it("lasă neschimbate JPEG/PNG/WebP când nu se poate redimensiona", async () => {
    const jpg = new File(["x"], "bon.jpg", { type: "image/jpeg" });
    await expect(prepareImageForUpload(jpg)).resolves.toBe(jpg);
  });
});
