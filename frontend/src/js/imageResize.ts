/**
 * Bilder vor dem AI-Import im Client verkleinern (ohne Abhängigkeit).
 *
 * Lange Kante höchstens `MAX_EDGE_PX`, kleinere Bilder werden nicht vergrößert.
 * Das Ergebnis ist immer ein JPEG; das wandelt auch HEIC und PNG um. Die
 * EXIF-Ausrichtung wird beim Dekodieren angewendet. Zusätzlich entsteht ein
 * kleines Vorschaubild für die Seitenliste (der Browser müsste sonst jede
 * 2000-px-Seite für die Anzeige erneut dekodieren).
 */

export const MAX_EDGE_PX = 2000;
export const JPEG_QUALITY = 0.85;
export const THUMB_EDGE_PX = 320;
export const THUMB_QUALITY = 0.7;

/** Fehler mit fertiger, deutscher Meldung (Bild nicht lesbar, z. B. HEIC ohne Dekoder). */
export class ImageResizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageResizeError";
  }
}

export interface ResizedImage {
  /** Verkleinertes JPEG für den AI-Aufruf und die Vorlage am Rezept. */
  blob: Blob;
  /** Kleines JPEG nur für die Anzeige. */
  thumbnail: Blob;
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

/**
 * Dekodiert mit EXIF-Ausrichtung. Kennt der Browser die Option nicht
 * (`TypeError`, ältere WebKit-Versionen), erneut ohne Optionen; nur ein echter
 * Dekodierfehler führt zur Format-Meldung.
 */
async function decode(file: Blob, name: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (err) {
    if (!(err instanceof TypeError))
      throw new ImageResizeError(unreadable(name));
  }
  try {
    return await createImageBitmap(file);
  } catch {
    throw new ImageResizeError(unreadable(name));
  }
}

/** Zeichnet das Bild auf die Zielgröße und kodiert als JPEG; gibt den Canvas-Speicher frei. */
async function renderJpeg(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  name: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  try {
    const { width, height } = computeTargetSize(
      bitmap.width,
      bitmap.height,
      maxEdge,
    );
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageResizeError(unreadable(name));
    // JPEG kennt keine Transparenz: weißer Grund statt Schwarz.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new ImageResizeError(unreadable(name));
    return blob;
  } finally {
    // iOS: Speicher sofort freigeben, bevor die nächste Seite dekodiert wird.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Verkleinert ein Bild auf ein JPEG samt Vorschau. Wirft `ImageResizeError` mit deutscher Meldung. */
export async function resizeImage(file: File | Blob): Promise<ResizedImage> {
  const name = file instanceof File ? file.name : "Bild";
  const bitmap = await decode(file, name);
  try {
    const blob = await renderJpeg(bitmap, MAX_EDGE_PX, JPEG_QUALITY, name);
    const thumbnail = await renderJpeg(
      bitmap,
      THUMB_EDGE_PX,
      THUMB_QUALITY,
      name,
    );
    return { blob, thumbnail };
  } finally {
    bitmap.close();
  }
}
