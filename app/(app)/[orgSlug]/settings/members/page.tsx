import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MailPlus } from "lucide-react";

import { InvitationRow } from "@/components/members/InvitationRow";
import { InviteMemberForm } from "@/components/members/InviteMemberForm";
import { MemberRow } from "@/components/members/MemberRow";
import { requireUser } from "@/lib/services/auth.service";
import * as membershipService from "@/lib/services/membership.service";
import * as organizationService from "@/lib/services/organization.service";
import { appUrl } from "@/lib/utils/app-url";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/validations/membership.schema";

export const metadata: Metadata = {
  title: "Members",
};

function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

export default async function MembersPage({
  params,
}: PageProps<"/[orgSlug]/settings/members">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const [user, role] = await Promise.all([
    requireUser(),
    organizationService.roleIn(organization.id),
  ]);

  const canManage = role === "owner" || role === "manager";

  // RLS already refuses the writes, so this is about not showing controls that
  // would fail — not about enforcement. The database is the enforcement.
  const [members, invitations] = await Promise.all([
    membershipService.listMembers(organization.id),
    canManage
      ? membershipService.listInvitations(organization.id)
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone who can see {organization.name}. People join by invitation —
        signing up on their own would create a separate organization, not join
        this one.
      </p>

      {canManage ? (
        <div className="mt-8 rounded-lg border p-4">
          <InviteMemberForm orgSlug={organization.slug} />
        </div>
      ) : null}

      <h2 className="mt-10 text-sm font-medium">
        Members
        <span className="ml-2 tabular-nums text-muted-foreground">
          {members.length}
        </span>
      </h2>
      <ul className="mt-3 divide-y rounded-lg border">
        {members.map((member) => (
          <MemberRow
            key={member.membershipId}
            member={member}
            orgSlug={organization.slug}
            canManage={canManage}
            isSelf={member.userId === user.id}
          />
        ))}
      </ul>

      {canManage ? (
        <>
          <h2 className="mt-10 text-sm font-medium">
            Pending invitations
            <span className="ml-2 tabular-nums text-muted-foreground">
              {invitations.length}
            </span>
          </h2>

          {invitations.length === 0 ? (
            <div className="mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <MailPlus className="size-7 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm text-muted-foreground">
                Nobody is waiting on an invitation.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border">
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  inviteUrl={inviteUrl(invitation.token)}
                  orgSlug={organization.slug}
                />
              ))}
            </ul>
          )}

          <h2 className="mt-10 text-sm font-medium">What the roles mean</h2>
          <dl className="mt-3 divide-y rounded-lg border">
            {(["owner", "manager", "staff"] as const).map((key) => (
              <div key={key} className="px-4 py-3">
                <dt className="text-sm font-medium">{ROLE_LABELS[key]}</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">
                  {ROLE_DESCRIPTIONS[key]}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </main>
  );
}
