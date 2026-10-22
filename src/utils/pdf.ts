import { MAX_SIDE, canvasToJpeg } from "./image";

/** Dimensiunea maximă a PDF-ului; se citește doar prima pagină (bonurile și facturile simple au una). */
const MAX_PDF_BYTES = 20_000_000;

/**
 * Randează prima pagină a unui PDF ca JPEG. Modelele de viziune citesc imagini, nu PDF-uri,
 * deci conversia se face în browser, iar restul fluxului de scanare rămâne neschimbat.
 */
export async function renderPdfFirstPage(file: Blob): Promise<Blob> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF-ul este prea mare (maximum 20 MB).");
  }
  // Încărcat la cerere: biblioteca PDF nu intră în pachetul principal.
  // Build-ul „legacy” rulează și în browsere mai vechi (inclusiv cele încorporate în editoare).
  // Worker-ul se încarcă ca modul din același pachet și rulează pe firul principal: așa nu depinde
  // de un fișier .mjs separat (servere/proxy-uri care îl servesc cu un MIME greșit, browsere fără module în worker).
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: MAX_SIDE / Math.max(base.width, base.height),
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob = await canvasToJpeg(canvas);
    if (!blob) throw new Error("canvas");
    return blob;
  } catch (error) {
    console.error("Citirea PDF-ului a eșuat:", error);
    if (error instanceof Error && error.name === "PasswordException") {
      throw new Error("PDF-ul este protejat cu parolă.");
    }
    const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new Error(
      `PDF-ul nu a putut fi citit${detail}. Încearcă o poză sau un alt fișier.`,
    );
  } finally {
    void loading.destroy();
  }
}
