/**
 * FormData gives back `""` for a field the user left blank, never `null`.
 * Feeding that straight into a nullable column stores an empty string where
 * the schema means "unknown", and the two are not the same thing — an empty
 * issuer is a fact we do not have, not a fact that is empty.
 */
export function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A required text field, as a string FormData may or may not contain. */
export function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}
