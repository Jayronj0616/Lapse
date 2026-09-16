"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle, MailCheck } from "lucide-react";

import { signUpAction } from "@/lib/actions/auth.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    signUpAction,
    {},
  );

  // Sign-up succeeded but the project requires email confirmation, so there is
  // no session yet. Showing the form again would look like nothing happened.
  if (state.message) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-8 text-status-ok" aria-hidden />
        <p className="text-sm text-muted-foreground">{state.message}</p>
        {/* This shadcn style's Button has no `asChild`, so the link is styled
            with buttonVariants rather than nested inside a Button. */}
        <Link
          href="/login"
          className={buttonVariants({
            variant: "secondary",
            className: "w-full",
          })}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
        />
        {state.fieldErrors?.fullName ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.fullName[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          At least 8 characters.
        </p>
        {state.fieldErrors?.password ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Creating account
          </>
        ) : (
          "Create account"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
