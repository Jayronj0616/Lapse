import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuditEntry } from "@/lib/supabase/types";

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditError";
  }
}

export type AuditEntryWithActor = AuditEntry & {
  actor: { full_name: string | null; email: string } | null;
};

/**
 * Reads the audit log. There is deliberately no write function here.
 *
 * Audit rows are produced by the `record_audit` trigger in migration 0002, not
 * by application code. A service that has to remember to log is a service that
 * will eventually forget, and a log with gaps is worse than none — it invites
 * the assumption that an absent row means nothing happened.
 *
 * RLS restricts reads to owners and managers, so a staff member calling this
 * simply gets an empty list rather than an error.
 */
export async function listForOrganization(
  organizationId: string,
  limit = 100,
): Promise<AuditEntryWithActor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select("*, actor:profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AuditError(`Could not load the audit log: ${error.message}`);
  }

  return (data ?? []) as unknown as AuditEntryWithActor[];
}
