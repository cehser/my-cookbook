/**
 * Seiten des AI-Foto-Imports (verkleinerte Blobs + Vorschau).
 *
 * Der Zustand liegt auf Modulebene: Schließt man den Import-Dialog versehentlich
 * (und wird sein Inhalt dabei abgebaut), bleiben die Aufnahmen erhalten. Er wird
 * erst durch `clearPages` (Import, „Neu“) geleert.
 */

import { ref } from "vue";

export interface ImportPage {
  id: number;
  /** Verkleinertes JPEG (Upload, später W.28). */
  blob: Blob;
  /** Object-URL des Vorschaubilds. */
  url: string;
}

const pages = ref<ImportPage[]>([]);
let nextId = 1;

export function useImportPages() {
  const addPage = (blob: Blob, thumbnail: Blob) => {
    pages.value.push({
      id: nextId++,
      blob,
      url: URL.createObjectURL(thumbnail),
    });
  };

  const removePage = (id: number) => {
    const page = pages.value.find((p) => p.id === id);
    if (page) URL.revokeObjectURL(page.url);
    pages.value = pages.value.filter((p) => p.id !== id);
  };

  const clearPages = () => {
    pages.value.forEach((p) => URL.revokeObjectURL(p.url));
    pages.value = [];
  };

  return { pages, addPage, removePage, clearPages };
}
