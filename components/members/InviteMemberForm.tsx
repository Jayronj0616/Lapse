"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";

import { inviteMemberAction } from "@/lib/actions/membership.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/validations/membership.schema";

const SELECT_CLASSES =
  "border-input bg-transparent dark:bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function InviteMemberForm({ orgSlug }: { orgSlug: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    inviteMemberAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="space-y-2">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="driver@company.com"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        {/* Owner is absent on purpose: promoting someone to owner is a
            deliberate act on an existing member, not something done by typing
            an address into an invite box. */}
        <select
          id="invite-role"
          name="role"
          className={SELECT_CLASSES}
          defaultValue="staff"
        >
          <option value="staff">{ROLE_LABELS.staff}</option>
          <option value="manager">{ROLE_LABELS.manager}</option>
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <UserPlus className="size-4" />
        )}
        Invite
      </Button>

      {state.fieldErrors?.email ? (
        <p className="text-sm text-destructive sm:col-span-3">
          {state.fieldErrors.email[0]}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="break-all text-sm text-status-ok sm:col-span-3">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
