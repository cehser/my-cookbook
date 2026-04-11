import { ref, type Ref } from "vue";

const DRAFT_PREFIX = "draft:";

/**
 * Scans localStorage for draft:* keys and returns a reactive set of UUIDs
 * that have unsaved drafts. Call `refresh()` to re-scan.
 */
export function useDraftIndex(): {
  draftUuids: Ref<Set<string>>;
  hasDraft: (uuid: string) => boolean;
  refresh: () => void;
} {
  const draftUuids = ref<Set<string>>(scan());

  function scan(): Set<string> {
    const uuids = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DRAFT_PREFIX)) {
          uuids.add(key.slice(DRAFT_PREFIX.length));
        }
      }
    } catch {
      // localStorage unavailable
    }
    return uuids;
  }

  function hasDraft(uuid: string): boolean {
    return draftUuids.value.has(uuid);
  }

  function refresh() {
    draftUuids.value = scan();
  }

  return { draftUuids, hasDraft, refresh };
}
