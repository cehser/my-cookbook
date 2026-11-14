/**
 * Offline-Cache in IndexedDB für Rezepte, Rezeptdetails, Settings und Favoriten.
 *
 * Einziger Zugriffspunkt auf diese Schlüssel. Der Cache ist Ersatz für die API
 * bei Offline oder API-Ausfall, keine eigene Datenquelle. Lesefehler (z. B.
 * IndexedDB im privaten Modus gesperrt) liefern `undefined`, Schreibfehler
 * werden nur protokolliert.
 *
 * Werte müssen per Structured Clone speicherbar sein: keine reaktiven
 * Vue-Proxies übergeben, sondern Kopien (`deepCopyJSON`).
 *
 * Bilder (`recipe_pictures`) liegen weiterhin im Store (Altbestand).
 */

import { get, set } from "idb-keyval";
import type { Recipe } from "@/types/recipe";
import type { Settings } from "@/types/settings";

const KEY_RECIPES = "recipes";
const KEY_SETTINGS = "settings";
const KEY_FAVORITES = "favorites";
const recipeDetailKey = (uuid: string) => `recipe:${uuid}`;

async function read<T>(key: string): Promise<T | undefined> {
  try {
    return (await get(key)) as T | undefined;
  } catch (e) {
    console.warn(`[OfflineCache] Lesen von "${key}" fehlgeschlagen`, e);
    return undefined;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value);
  } catch (e) {
    console.warn(`[OfflineCache] Schreiben von "${key}" fehlgeschlagen`, e);
  }
}

let knownRecipes = false;

/** Rezeptliste (Kopfdaten, Details separat). */
export function readRecipes(): Promise<Recipe[] | undefined> {
  return read<Recipe[]>(KEY_RECIPES);
}

export function writeRecipes(recipes: Recipe[]): Promise<void> {
  knownRecipes = true;
  return write(KEY_RECIPES, recipes);
}

/** Liegt eine Rezeptliste im Cache? (einmal gelesen, danach gemerkt) */
export async function hasCachedRecipes(): Promise<boolean> {
  if (!knownRecipes) knownRecipes = (await readRecipes()) !== undefined;
  return knownRecipes;
}

/** Vollständiges Rezept (Zutaten, Schritte) für die Offline-Anzeige. */
export function readRecipeDetail(uuid: string): Promise<Recipe | undefined> {
  return read<Recipe>(recipeDetailKey(uuid));
}

export function writeRecipeDetail(recipe: Recipe): Promise<void> {
  return write(recipeDetailKey(recipe.recipe_uuid), recipe);
}

export function readSettings(): Promise<Settings | undefined> {
  return read<Settings>(KEY_SETTINGS);
}

export function writeSettings(settings: Settings): Promise<void> {
  return write(KEY_SETTINGS, settings);
}

export function readFavorites(): Promise<string[] | undefined> {
  return read<string[]>(KEY_FAVORITES);
}

export function writeFavorites(favorites: string[]): Promise<void> {
  return write(KEY_FAVORITES, favorites);
}
