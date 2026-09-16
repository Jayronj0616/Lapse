/**
 * Turns a display name into a URL slug matching the CHECK constraint on
 * `organizations.slug`: lowercase alphanumerics separated by single hyphens,
 * no leading or trailing hyphen.
 */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    // strip combining marks so "Ñuñez" becomes "nunez" rather than "uez"
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  // A name of pure punctuation or non-Latin script can slugify to nothing, and
  // an empty slug would fail the CHECK constraint with an opaque database error.
  return slug || "org";
}

/** Short disambiguating suffix for when a slug is already taken. */
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
