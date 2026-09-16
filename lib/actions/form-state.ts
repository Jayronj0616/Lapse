/**
 * The shape every Server Action returns to a `useActionState` form.
 *
 * Kept out of the `"use server"` files on purpose: those modules may only
 * export async functions, and a shared type is easier to import from a plain
 * module than to thread through one.
 *
 * - `fieldErrors` — Zod validation, keyed by field name
 * - `error` — the action failed as a whole
 * - `message` — the action succeeded but there is something to say, e.g. "check
 *   your inbox", where redirecting would be wrong
 */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
};
