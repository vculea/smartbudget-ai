/** Latura maximă (px) a pozei trimise la scanare; bonurile rămân lizibile, iar încărcarea e rapidă. */
const MAX_SIDE = 1600;
/** Sub această dimensiune și în limitele de mai sus, poza se trimite neschimbată. */
const KEEP_ORIGINAL_BELOW_BYTES = 1_500_000;
const JPEG_QUALITY = 0.85;

/**
 * Micșorează poza făcută cu telefonul (adesea 5–10 MB) înainte de upload și aplică orientarea EXIF.
 * Dacă browserul nu poate decoda sau redesena imaginea, se trimite fișierul original.
 */
export async function prepareImageForUpload(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= KEEP_ORIGINAL_BELOW_BYTES) return file;

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      return blob && blob.size < file.size ? blob : file;
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
