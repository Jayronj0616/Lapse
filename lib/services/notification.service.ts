import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/supabase/types";

export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationError";
  }
}

export type NotificationWithReminder = Notification & {
  reminder: { id: string; acknowledged_at: string | null } | null;
};

/**
 * The caller's own notifications in an organization.
 *
 * The RLS policy is `user_id = auth.uid()`, so this returns only the viewer's
 * rows no matter what — the `organization_id` filter narrows to the one they
 * are looking at, it does not protect anything.
 */
export async function listForUser(
  organizationId: string,
): Promise<NotificationWithReminder[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*, reminder:reminders(id, acknowledged_at)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new NotificationError(
      `Could not load notifications: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as NotificationWithReminder[];
}

export async function countUnread(organizationId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("read_at", null);

  if (error) {
    throw new NotificationError(
      `Could not count notifications: ${error.message}`,
    );
  }

  return count ?? 0;
}

export async function markRead(notificationId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    throw new NotificationError(`Could not update: ${error.message}`);
  }
}

/**
 * Acknowledging a reminder — "I have seen this and I am dealing with it".
 *
 * Goes through the `acknowledge_reminder` database function rather than an
 * update, so the caller can only perform that one specific act. An update
 * policy permissive enough to allow acknowledging would also allow rewriting
 * `scheduled_for` or clearing `escalated_at`, which is exactly what an
 * escalation record must not permit.
 *
 * It is also what stops escalation to the owner, so it is a decision worth
 * recording precisely.
 */
export async function acknowledgeReminder(reminderId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("acknowledge_reminder", {
    reminder: reminderId,
  });

  if (error) {
    throw new NotificationError(
      `Could not acknowledge the reminder: ${error.message}`,
    );
  }
}
