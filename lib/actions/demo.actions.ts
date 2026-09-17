"use server";

import { redirect } from "next/navigation";

import * as authService from "@/lib/services/auth.service";
import * as organizationService from "@/lib/services/organization.service";

import type { FormState } from "./form-state";

/**
 * Signs the visitor in as the demo account and drops them on its dashboard.
 *
 * Two reasons this is better than printing credentials on the page:
 *
 * 1. **Nobody has to type anything.** A demo that asks a stranger to copy a
 *    password before they can look at it loses most of them at that step.
 *
 * 2. **The password stops being public.** It previously lived in
 *    `NEXT_PUBLIC_DEMO_PASSWORD`, which Next compiles into the JavaScript
 *    every visitor downloads. `DEMO_EMAIL` and `DEMO_PASSWORD` are read here,
 *    on the server, and never reach a browser.
 *
 * The credentials are fixed by the environment — this action takes no input,
 * so it cannot be used to sign in as anybody else. What it grants is exactly
 * what the demo account can do: manager in one seeded organization, unable to
 * delete it, remove members or change roles.
 */
export async function enterDemoAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) {
    return { error: "The demo is not configured on this deployment." };
  }

  try {
    await authService.signIn({ email, password });
  } catch {
    // Deliberately vague. The visitor can do nothing about a misconfigured
    // demo account, and naming the failure would only describe our own
    // credentials back to them.
    return { error: "The demo is unavailable right now. Try again shortly." };
  }

  const organizations = await organizationService.listMine();

  if (organizations.length === 0) {
    return { error: "The demo data has not been seeded on this deployment." };
  }

  redirect(`/${organizations[0].slug}/dashboard`);
}
