/** Latura maximă (px) a pozei trimise la scanare; bonurile rămân lizibile, iar încărcarea e rapidă. */
export const MAX_SIDE = 1600;
/** Sub această dimensiune și în limitele de mai sus, poza se trimite neschimbată. */
const KEEP_ORIGINAL_BELOW_BYTES = 1_500_000;
const JPEG_QUALITY = 0.85;

/** Formatele pe care backendul și modelele de viziune le primesc direct. */
const NATIVE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PDF_EXTENSION = /\.pdf$/i;
/** Formatele fără tip MIME în unele sisteme (ex. HEIC pe Windows) se recunosc după extensie. */
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?|svg)$/i;

/** Extensiile și tipurile afișate în selectorul de fișiere. */
export const RECEIPT_FILE_ACCEPT =
  "image/*,application/pdf,.pdf,.heic,.heif,.avif,.bmp,.gif,.tif,.tiff";

export const UNSUPPORTED_FILE_MESSAGE =
  "Fișierul nu este acceptat. Alege o poză (JPG, PNG, WebP, HEIC, AVIF, GIF, BMP) sau un PDF.";

function fileName(file: Blob): string {
  return file instanceof File ? file.name : "";
}

function isPdf(file: Blob): boolean {
  return file.type === "application/pdf" || PDF_EXTENSION.test(fileName(file));
}

function isImage(file: Blob): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(fileName(file));
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
}

/**
 * Pregătește fișierul pentru scanare: PDF-ul devine imagine (prima pagină), formatele neacceptate
 * de model (HEIC, AVIF, GIF, BMP...) se convertesc în JPEG, iar pozele mari se micșorează.
 */
export async function prepareImageForUpload(file: Blob): Promise<Blob> {
  if (isPdf(file)) {
    const { renderPdfFirstPage } = await import("./pdf");
    return renderPdfFirstPage(file);
  }
  if (!isImage(file)) throw new Error(UNSUPPORTED_FILE_MESSAGE);

  const mustConvert = !NATIVE_TYPES.includes(file.type);
  const fail = () => {
    if (mustConvert) {
      throw new Error(
        "Formatul pozei nu poate fi citit de acest browser. Salveaz-o ca JPG sau PNG și încearcă din nou.",
      );
    }
    return file;
  };
  if (typeof createImageBitmap !== "function") return fail();
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      if (!mustConvert && scale === 1 && file.size <= KEEP_ORIGINAL_BELOW_BYTES) {
        return file;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return fail();
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToJpeg(canvas);
      if (!blob) return fail();
      return mustConvert || blob.size < file.size ? blob : file;
    } finally {
      bitmap.close();
    }
  } catch {
    return fail();
  }
}
