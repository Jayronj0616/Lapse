/**
 * Environment access for the Supabase clients.
 *
 * These throw at call time rather than at import time. Throwing during module
 * evaluation would break `next build`, which imports modules without a real
 * environment — the failure would surface as a confusing build error instead
 * of a clear runtime one.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/** Project URL. Safe in the browser. */
export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/**
 * Publishable key (`sb_publishable_…`). Replaces what Supabase used to call the
 * anon key. Ships in the browser bundle by design — it is not a secret, and
 * RLS is what actually protects the data behind it.
 */
export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Secret key (`sb_secret_…`). Replaces the old service_role key.
 *
 * This bypasses Row Level Security completely. It is read only by
 * lib/supabase/admin.ts, which is marked server-only.
 */
export function supabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}
