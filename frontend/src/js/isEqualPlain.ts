/**
 * Strukturelle Gleichheit für JSON-artige Daten (Primitive, Arrays, einfache
 * Objekte, beliebig verschachtelt). Strikt (`===`), keine Unterstützung für
 * `Date`, `Map`, `Set`, Zyklen.
 */
export function isEqualPlain(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => isEqualPlain(v, b[i]))
    );
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  return (
    aKeys.length === Object.keys(bObj).length &&
    aKeys.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(bObj, k) &&
        isEqualPlain(aObj[k], bObj[k]),
    )
  );
}
