import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SignInInput, SignUpInput } from "@/lib/validations/auth.schema";

/**
 * Auth business logic. Callers pass already-validated input; these functions
 * return data or throw, and never redirect — redirects belong to the actions.
 */

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function signIn({ email, password }: SignInInput) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase distinguishes "no such user" from "wrong password". We do not:
    // telling an anonymous caller which emails exist is an account-enumeration
    // hole, and it buys the legitimate user nothing.
    throw new AuthError("That email and password do not match.");
  }
}

export async function signUp({ fullName, email, password }: SignUpInput) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to populate profiles.full_name.
      data: { full_name: fullName },
    },
  });

  if (error) {
    throw new AuthError(error.message);
  }

  // With email confirmation enabled (Supabase's default) sign-up succeeds but
  // returns no session — the user is created and must confirm before they can
  // sign in. The caller has to branch on this, otherwise it redirects someone
  // to a dashboard they are not yet authenticated for.
  return { needsEmailConfirmation: data.session === null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * The signed-in user, or null.
 *
 * getUser() revalidates against Supabase rather than trusting the cookie. Any
 * authorization decision must go through this, never through getSession().
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user, or throw. For paths the middleware already guards. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated.");
  return user;
}
