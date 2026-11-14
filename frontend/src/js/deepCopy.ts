/**
 * Create a deep copy of JSON-compatible data via JSON serialization.
 * Reads through Vue proxies (unlike `structuredClone`). Not suited for
 * `Date`, `Map`, `Set`, functions; `undefined` values are dropped.
 */
export function deepCopyJSON<T>(src: T): T {
  return JSON.parse(JSON.stringify(src)) as T;
}
