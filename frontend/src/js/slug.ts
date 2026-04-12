/**
 * Generate a URL-safe slug from a recipe name.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

/**
 * Build a recipe URL path: /recipe/:uuid/:slug
 */
export function recipeUrl(uuid: string, name: string): string {
  const slug = slugify(name || "rezept");
  return `/recipe/${uuid}/${slug}`;
}

/**
 * Build an edit URL path: /edit/:uuid/:slug
 */
export function editUrl(uuid: string, name: string): string {
  const slug = slugify(name || "rezept");
  return `/edit/${uuid}/${slug}`;
}
