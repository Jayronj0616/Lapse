"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

import {
  changeRoleAction,
  removeMemberAction,
} from "@/lib/actions/membership.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import type { Member } from "@/lib/services/membership.service";
import { MEMBER_ROLES, ROLE_LABELS } from "@/lib/validations/membership.schema";

const SELECT_CLASSES =
  "border-input bg-transparent dark:bg-input/30 h-9 rounded-md border px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function MemberRow({
  member,
  orgSlug,
  canChangeRoles,
  isSelf,
}: {
  member: Member;
  orgSlug: string;
  /**
   * Owners only — not managers.
   *
   * The RLS policies on `memberships` restrict both UPDATE and DELETE to
   * owners, while invitations are open to managers too. Rendering these
   * controls for a manager would offer a button that the database always
   * refuses; the service turns that into a readable message, but a control
   * that can never succeed should not be on screen at all.
   */
  canChangeRoles: boolean;
  isSelf: boolean;
}) {
  const [roleState, changeRole, changingRole] = useActionState<
    FormState,
    FormData
  >(changeRoleAction, {});
  const [removeState, removeMember, removing] = useActionState<
    FormState,
    FormData
  >(removeMemberAction, {});

  const error = roleState.error ?? removeState.error;

  return (
    <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.fullName ?? member.email}
          {isSelf ? (
            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
          ) : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
        {error ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {canChangeRoles ? (
        <div className="flex shrink-0 items-center gap-2">
          <form action={changeRole} className="flex items-center gap-2">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input
              type="hidden"
              name="membershipId"
              value={member.membershipId}
            />
            <label className="sr-only" htmlFor={`role-${member.membershipId}`}>
              Role for {member.email}
            </label>
            <select
              id={`role-${member.membershipId}`}
              name="role"
              className={SELECT_CLASSES}
              defaultValue={member.role}
            >
              {MEMBER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={changingRole}
            >
              {changingRole ? <LoaderCircle className="animate-spin" /> : null}
              Save
            </Button>
          </form>

          <form action={removeMember}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input
              type="hidden"
              name="membershipId"
              value={member.membershipId}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={removing}
              className="text-destructive"
            >
              Remove
            </Button>
          </form>
        </div>
      ) : (
        <span className="shrink-0 text-sm text-muted-foreground">
          {ROLE_LABELS[member.role]}
        </span>
      )}
    </li>
  );
}
