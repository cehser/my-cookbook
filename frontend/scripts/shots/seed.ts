/**
 * Seed im Browser: Sitzung, Rolle und weitere Einträge in localStorage,
 * Vormerkung und Cache in IndexedDB (`idb-keyval`: DB `keyval-store`,
 * Store `keyval`). Läuft per `page.evaluate` auf der Seed-Seite derselben
 * Origin, bevor die App startet; muss daher ohne Importe auskommen.
 */

export interface BrowserSeed {
  localStorage: Record<string, string>;
  idb: Record<string, unknown>;
}

export async function applySeed(seed: BrowserSeed): Promise<void> {
  localStorage.clear();
  for (const [key, value] of Object.entries(seed.localStorage)) {
    localStorage.setItem(key, value);
  }
  await new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase("keyval-store");
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
    del.onblocked = () => resolve();
  });
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("keyval-store");
    open.onupgradeneeded = () => open.result.createObjectStore("keyval");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("keyval", "readwrite");
    const store = tx.objectStore("keyval");
    for (const [key, value] of Object.entries(seed.idb)) store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
