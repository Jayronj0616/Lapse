"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import * as authService from "@/lib/services/auth.service";
import { signInSchema, signUpSchema } from "@/lib/validations/auth.schema";

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

  if (needsEmailConfirmation) {
    return {
      message:
        "Check your inbox — confirm your email address, then sign in.",
    };
  }

  redirect("/");
}

export async function signOutAction() {
  await authService.signOut();
  redirect("/login");
}
