"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

import { acceptInvitationAction } from "@/lib/actions/membership.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";

export function AcceptInvitationForm({
  token,
  organizationName,
}: {
  token: string;
  organizationName: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    acceptInvitationAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Join {organizationName}
      </Button>
    </form>
  );
}
