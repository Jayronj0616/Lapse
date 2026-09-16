"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

import { createOrganizationAction } from "@/lib/actions/organization.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createOrganizationAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="organization"
          placeholder="Northern Freight"
          required
          autoFocus
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        {state.fieldErrors?.name ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.name[0]}
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
            Creating
          </>
        ) : (
          "Create organization"
        )}
      </Button>
    </form>
  );
}
