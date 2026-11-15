/**
 * Bilder vor dem AI-Import im Client verkleinern (ohne Abhängigkeit).
 *
 * Lange Kante höchstens `MAX_EDGE_PX`, kleinere Bilder werden nicht vergrößert.
 * Das Ergebnis ist immer ein JPEG; das wandelt auch HEIC und PNG um. Die
 * EXIF-Ausrichtung wird beim Dekodieren angewendet.
 */

export const MAX_EDGE_PX = 2000;
export const JPEG_QUALITY = 0.85;

/** Fehler mit fertiger, deutscher Meldung (Bild nicht lesbar, z. B. HEIC ohne Dekoder). */
export class ImageResizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageResizeError";
  }
}

/** Zielgröße: lange Kante auf `maxEdge` begrenzen, Seitenverhältnis halten, nie vergrößern. */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE_PX,
): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const unreadable = (name: string) =>
  `Das Bild „${name}“ konnte nicht gelesen werden. Dieses Format (z. B. HEIC) wird vom Browser nicht unterstützt; bitte als JPEG aufnehmen oder wählen.`;

/** Verkleinert ein Bild auf ein JPEG. Wirft `ImageResizeError` mit deutscher Meldung. */
export async function resizeImage(file: File | Blob): Promise<Blob> {
  const name = file instanceof File ? file.name : "Bild";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageResizeError(unreadable(name));
  }

  const canvas = document.createElement("canvas");
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageResizeError(unreadable(name));
    // JPEG kennt keine Transparenz: weißer Grund statt Schwarz.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new ImageResizeError(unreadable(name));
    return blob;
  } finally {
    // iOS: Speicher sofort freigeben, bevor die nächste Seite dekodiert wird.
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
