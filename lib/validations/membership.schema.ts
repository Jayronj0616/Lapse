import { z } from "zod";

export const MEMBER_ROLES = ["owner", "manager", "staff"] as const;

export const ROLE_LABELS: Record<(typeof MEMBER_ROLES)[number], string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<(typeof MEMBER_ROLES)[number], string> = {
  owner:
    "Full control, including billing-level settings, roles, and deleting the organization. Escalated reminders land here.",
  manager:
    "Can add subjects, invite people, review documents, and read the audit log.",
  staff:
    "Can file documents and review the ones they are responsible for.",
};

export const inviteMemberSchema = z.object({
  email: z.email("Enter a valid email address."),
  // Owner is deliberately absent: promoting someone to owner is a separate,
  // deliberate act on an existing member, not something done by typing an
  // address into an invite box.
  role: z.enum(["manager", "staff"], { error: "Choose a role." }),
});

export const changeRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(MEMBER_ROLES),
});

export const removeMemberSchema = z.object({
  membershipId: z.uuid(),
});

export const revokeInvitationSchema = z.object({
  invitationId: z.uuid(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
