import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Subject, SubjectKind } from "@/lib/supabase/types";

export class SubjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubjectError";
  }
}

/**
 * Subjects in an organization.
 *
 * The `organization_id` filter here is not what enforces isolation — the RLS
 * policy already restricts this table to the caller's organizations. It is
 * here because a user may belong to several, and this asks for one of them.
 */
export async function listForOrganization(
  organizationId: string,
): Promise<Subject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("organization_id", organizationId)
    .order("label", { ascending: true });

  if (error) {
    throw new SubjectError(`Could not load subjects: ${error.message}`);
  }

  return data ?? [];
}

export async function getById(id: string): Promise<Subject | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new SubjectError(`Could not load subject: ${error.message}`);
  }

  return data;
}

export async function create(input: {
  organizationId: string;
  kind: SubjectKind;
  label: string;
  identifier: string | null;
}): Promise<Subject> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      organization_id: input.organizationId,
      kind: input.kind,
      label: input.label,
      identifier: input.identifier,
    })
    .select()
    .single();

  if (error) {
    // RLS rejects a write by someone without the role rather than returning a
    // helpful message, so translate the generic failure into something a staff
    // member can act on.
    throw new SubjectError(
      error.code === "42501"
        ? "Only owners and managers can add subjects."
        : `Could not create the subject: ${error.message}`,
    );
  }

  return data;
}
