/**
 * Seiten des AI-Foto-Imports (verkleinerte Blobs + Vorschau).
 *
 * Der Zustand liegt auf Modulebene, damit er einen Routenwechsel übersteht: Verlässt
 * man die Startseite, wird `AIRecipeImport` abgebaut, die Aufnahmen bleiben. (Das
 * Schließen des Dialogs allein baut nichts ab: `BModal` ohne `lazy` behält seinen
 * Inhalt.) Geleert wird er erst durch `clearPages` (Import, „Neu“).
 */

import { ref } from "vue";

export interface ImportPage {
  id: number;
  /** Verkleinertes JPEG (AI-Aufruf, danach Vorlage am Rezept). */
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
