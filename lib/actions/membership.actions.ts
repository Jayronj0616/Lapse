"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendEmail } from "@/lib/email/resend";
import * as authService from "@/lib/services/auth.service";
import * as membershipService from "@/lib/services/membership.service";
import * as organizationService from "@/lib/services/organization.service";
import {
  changeRoleSchema,
  inviteMemberSchema,
  removeMemberSchema,
  revokeInvitationSchema,
} from "@/lib/validations/membership.schema";

import { text } from "./form-data";
import type { FormState } from "./form-state";

function inviteUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/invite/${token}`;
}

export async function inviteMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let url: string;

  try {
    const invitation = await membershipService.invite(
      organization.id,
      parsed.data,
    );
    url = inviteUrl(invitation.token);
  } catch (error) {
    return {
      error:
        error instanceof membershipService.MembershipError
          ? error.message
          : "Could not send the invitation. Try again.",
    };
  }

  // Email is best-effort. The invitation exists either way and its link is
  // shown on screen, so a missing Resend key degrades this to copy-and-paste
  // rather than breaking the feature outright.
  const result = await sendEmail({
    to: parsed.data.email,
    subject: `You have been invited to ${organization.name} on Lapse`,
    text: [
      `You have been invited to join ${organization.name} on Lapse, which tracks when compliance documents expire.`,
      "",
      `Accept here: ${url}`,
      "",
      "The link is valid for 14 days and works only for this email address.",
    ].join("\n"),
  });

  revalidatePath(`/${organization.slug}/settings/members`);

  return {
    message: result.ok
      ? `Invitation sent to ${parsed.data.email}.`
      : `Invitation created. Email could not be sent — share this link: ${url}`,
  };
}

export async function revokeInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = revokeInvitationSchema.safeParse({
    invitationId: text(formData.get("invitationId")),
  });
  if (!parsed.success) return { error: "That invitation is not valid." };

  try {
    await membershipService.revokeInvitation(parsed.data.invitationId);
  } catch (error) {
    return {
      error:
        error instanceof membershipService.MembershipError
          ? error.message
          : "Could not revoke it.",
    };
  }

  revalidatePath(`/${organization.slug}/settings/members`);
  return { message: "Invitation revoked." };
}

export async function changeRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = changeRoleSchema.safeParse({
    membershipId: text(formData.get("membershipId")),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "That role is not valid." };

  try {
    await membershipService.changeRole(parsed.data.membershipId, parsed.data.role);
  } catch (error) {
    return {
      error:
        error instanceof membershipService.MembershipError
          ? error.message
          : "Could not change the role.",
    };
  }

  revalidatePath(`/${organization.slug}/settings/members`);
  return { message: "Role updated." };
}

export async function removeMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await organizationService.getBySlug(
    text(formData.get("orgSlug")),
  );
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = removeMemberSchema.safeParse({
    membershipId: text(formData.get("membershipId")),
  });
  if (!parsed.success) return { error: "That member is not valid." };

  try {
    await membershipService.removeMember(parsed.data.membershipId);
  } catch (error) {
    return {
      error:
        error instanceof membershipService.MembershipError
          ? error.message
          : "Could not remove them.",
    };
  }

  revalidatePath(`/${organization.slug}/settings/members`);
  return { message: "Member removed." };
}

/**
 * Signs out and returns to the same invitation.
 *
 * Someone following an invitation link while signed in as the wrong account
 * needs to end up back here afterwards. The ordinary sign-out drops them at
 * `/login` with no memory of what they were trying to join.
 */
export async function signOutToInviteAction(formData: FormData) {
  const token = text(formData.get("token"));
  await authService.signOut();
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}

export async function acceptInvitationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = text(formData.get("token"));
  let slug: string;

  try {
    slug = await membershipService.acceptInvitation(token);
  } catch (error) {
    return {
      error:
        error instanceof membershipService.MembershipError
          ? error.message
          : "Could not accept that invitation.",
    };
  }

  redirect(`/${slug}/dashboard`);
}
