import { ref, type Ref } from "vue";

const STORAGE_KEY = "recent-recipes";
const MAX_RECENT = 8;

interface RecentEntry {
  uuid: string;
  timestamp: number;
}

/**
 * Tracks recently opened recipes in localStorage.
 * Call `trackRecipe(uuid)` when a recipe is viewed.
 */
export function useRecentRecipes(): {
  recentUuids: Ref<string[]>;
  trackRecipe: (uuid: string) => void;
} {
  const recentUuids = ref<string[]>(load());

  function load(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const entries: RecentEntry[] = JSON.parse(raw);
      return entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_RECENT)
        .map((e) => e.uuid);
    } catch {
      return [];
    }
  }

  function trackRecipe(uuid: string) {
    if (!uuid) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const entries: RecentEntry[] = raw ? JSON.parse(raw) : [];
      const filtered = entries.filter((e) => e.uuid !== uuid);
      filtered.unshift({ uuid, timestamp: Date.now() });
      const trimmed = filtered.slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      recentUuids.value = trimmed.map((e) => e.uuid);
    } catch {
      // localStorage full or unavailable
    }
  }

  return { recentUuids, trackRecipe };
}
