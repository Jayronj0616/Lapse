import "server-only";

import { requireUser } from "@/lib/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import type { Invitation, MemberRole } from "@/lib/supabase/types";

export class MembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipError";
  }
}

export type Member = {
  membershipId: string;
  userId: string;
  role: MemberRole;
  fullName: string | null;
  email: string;
  joinedAt: string;
};

function translate(code: string | undefined, fallback: string): string {
  // RLS refuses without explanation, so a permission failure arrives as a bare
  // 42501. Everything else keeps its own message.
  return code === "42501"
    ? "You do not have permission to do that."
    : fallback;
}

export async function listMembers(organizationId: string): Promise<Member[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, created_at, profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new MembershipError(`Could not load members: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const typed = row as unknown as {
      id: string;
      user_id: string;
      role: MemberRole;
      created_at: string;
      profiles: { full_name: string | null; email: string } | null;
    };

    return {
      membershipId: typed.id,
      userId: typed.user_id,
      role: typed.role,
      fullName: typed.profiles?.full_name ?? null,
      email: typed.profiles?.email ?? "",
      joinedAt: typed.created_at,
    };
  });
}

/** Pending invitations only — accepted ones are members now. */
export async function listInvitations(
  organizationId: string,
): Promise<Invitation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new MembershipError(`Could not load invitations: ${error.message}`);
  }

  return data ?? [];
}

export async function invite(
  organizationId: string,
  input: { email: string; role: MemberRole },
): Promise<Invitation> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: organizationId,
      email: input.email,
      role: input.role,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // The partial unique index on pending invitations is what produces this.
    if (error.code === "23505") {
      throw new MembershipError(
        "That person already has an invitation waiting.",
      );
    }
    throw new MembershipError(
      translate(error.code, `Could not send the invitation: ${error.message}`),
    );
  }

  return data;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    throw new MembershipError(
      translate(error.code, `Could not revoke it: ${error.message}`),
    );
  }
}

export async function changeRole(
  membershipId: string,
  role: MemberRole,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId);

  if (error) {
    // guard_last_owner raises this rather than letting an organization end up
    // with nobody who can administer it.
    if (error.message.includes("at least one owner")) {
      throw new MembershipError(
        "An organization must keep at least one owner. Promote someone else first.",
      );
    }
    throw new MembershipError(
      translate(error.code, `Could not change the role: ${error.message}`),
    );
  }
}

export async function removeMember(membershipId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId);

  if (error) {
    if (error.message.includes("at least one owner")) {
      throw new MembershipError(
        "An organization must keep at least one owner. Promote someone else first.",
      );
    }
    throw new MembershipError(
      translate(error.code, `Could not remove them: ${error.message}`),
    );
  }
}

/**
 * What an invitation link shows before anyone has signed in.
 *
 * Goes through a `SECURITY DEFINER` function callable by anon, because the
 * recipient has no account yet. It returns the organization's name, the
 * address invited, and whether the link is still good — and deliberately
 * nothing else. A token that has leaked should reveal as little as possible.
 */
export async function previewInvitation(token: string): Promise<{
  organizationName: string;
  email: string;
  valid: boolean;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("invitation_preview", {
    invite_token: token,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    organizationName: row.organization_name,
    email: row.email,
    valid: row.valid,
  };
}

/**
 * Joins the signed-in user to the organization the token belongs to.
 *
 * The database function requires the caller's email to match the invited
 * address. Without that check the token alone would grant membership, so a
 * forwarded link would let anyone in — the email match is what makes the token
 * a second factor rather than the entire credential.
 *
 * Returns the organization's slug so the caller knows where to send them.
 */
export async function acceptInvitation(token: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_invitation", {
    invite_token: token,
  });

  if (error) {
    // These messages come from RAISE EXCEPTION in the function and are written
    // to be read by the person following the link.
    throw new MembershipError(error.message.replace(/^.*?:\s*/, ""));
  }

  return data as string;
}
