"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";

import { revokeInvitationAction } from "@/lib/actions/membership.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import type { Invitation } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils/dates";
import { ROLE_LABELS } from "@/lib/validations/membership.schema";

export function InvitationRow({
  invitation,
  inviteUrl,
  orgSlug,
}: {
  invitation: Invitation;
  inviteUrl: string;
  orgSlug: string;
}) {
  const [state, revoke, revoking] = useActionState<FormState, FormData>(
    revokeInvitationAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is visible in the title
      // attribute either way, so there is nothing to recover from.
    }
  }

  if (state.message) return null;

  return (
    <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="truncate text-sm text-muted-foreground">
          {ROLE_LABELS[invitation.role]} · expires{" "}
          {formatDate(invitation.expires_at.slice(0, 10))}
        </p>
        {state.error ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={copy}
          title={inviteUrl}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>

        <form action={revoke}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={revoking}
            className="text-destructive"
          >
            Revoke
          </Button>
        </form>
      </div>
    </li>
  );
}
