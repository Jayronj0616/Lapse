"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import * as authService from "@/lib/services/auth.service";
import * as membershipService from "@/lib/services/membership.service";
import { signInSchema, signUpSchema } from "@/lib/validations/auth.schema";

/**
 * `redirect()` signals by throwing, so a try/catch around a call that also
 * redirects has to let that particular error through or the navigation is
 * swallowed and reported as a failure.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

import type { FormState } from "./form-state";

/**
 * `next` comes from a query string, so it is attacker-controlled. Only a
 * same-origin path is allowed through: a leading `//` is protocol-relative and
 * would send the user to another site while looking like a local path.
 */
function safeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await authService.signIn(parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof authService.AuthError
          ? error.message
          : "Could not sign in. Try again.",
    };
  }

  // Outside the try: redirect() works by throwing, so catching around it would
  // swallow the redirect and report it as a failure.
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let needsEmailConfirmation = false;

  try {
    ({ needsEmailConfirmation } = await authService.signUp(parsed.data));
  } catch (error) {
    return {
      error:
        error instanceof authService.AuthError
          ? error.message
          : "Could not create the account. Try again.",
    };
  }

  const invite = formData.get("invite");
  const inviteToken = typeof invite === "string" && invite ? invite : null;

  if (needsEmailConfirmation) {
    return {
      message: inviteToken
        ? "Check your inbox — confirm your email address, then open your invitation link again to join."
        : "Check your inbox — confirm your email address, then sign in.",
    };
  }

  // Signing up from an invitation joins that organization instead of creating
  // a new one. Without this branch a new member would land on the
  // organization-creation screen and end up owning an empty duplicate of the
  // company that just invited them.
  if (inviteToken) {
    try {
      const slug = await membershipService.acceptInvitation(inviteToken);
      redirect(`/${slug}/dashboard`);
    } catch (error) {
      // The account exists and they are signed in; only the joining failed.
      // Sending them to `/` would silently drop them into org creation, so say
      // what happened instead.
      if (isRedirectError(error)) throw error;
      return {
        error:
          error instanceof membershipService.MembershipError
            ? `Your account was created, but the invitation could not be accepted: ${error.message}`
            : "Your account was created, but the invitation could not be accepted.",
      };
    }
  }

  redirect("/");
}

export async function signOutAction() {
  await authService.signOut();
  redirect("/login");
}
