import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { escalationEmail, reminderEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DocumentStatus,
  DocumentType,
  ReminderTier,
} from "@/lib/supabase/types";
import { appUrl } from "@/lib/utils/app-url";
import { daysUntil, todayISO } from "@/lib/utils/dates";
import { statusFromExpiry } from "@/lib/utils/status";

import { inngest } from "./client";

export const SWEEP_JOB_NAME = "daily-sweep";

/** A reminder unacknowledged this long past its send escalates to the owner. */
const ESCALATE_AFTER_DAYS = 3;

/**
 * Which reminder is due for a document right now, or null if none is.
 *
 * Only the *most urgent* tier that applies is returned. A document uploaded
 * three days before it expires should get one "expiring within a week" notice,
 * not the whole ladder at once — and the unique constraint on
 * (document_id, tier, channel) makes each tier fire exactly once.
 *
 * That constraint also means `overdue` fires once rather than daily, which is
 * a deliberate departure from the original plan: an expired document already
 * sits permanently in the dashboard's "Expired" group, and a daily email about
 * it teaches people to filter the sender.
 */
function tierFor(days: number): ReminderTier | null {
  if (days < 0) return "overdue";
  if (days <= 1) return "t1";
  if (days <= 7) return "t7";
  if (days <= 30) return "t30";
  if (days <= 60) return "t60";
  return null;
}

type SweepSummary = {
  statusesUpdated: number;
  extractionsRetried: number;
  remindersCreated: number;
  emailsSent: number;
  notificationsCreated: number;
  escalated: number;
};

/**
 * The daily pass. Everything this system does without anyone logged in.
 *
 * Runs with the admin client, bypassing RLS — every query scopes its tenant by
 * hand, or operates on a table that holds no tenant data.
 *
 * The `job_runs` row is written *before* any work, not after. That is what
 * guarantees a database write every single day, which is what stops Supabase
 * pausing a free-tier project after a week of inactivity. An "exit early if
 * there is nothing to do" optimisation would break the keepalive on exactly
 * the quiet weeks where it matters most. It also means a crash leaves a row
 * stuck in `running`, which the dashboard can detect — writing only on success
 * would make failures invisible.
 */
export async function runSweep(): Promise<{
  runId: string;
  summary: SweepSummary;
}> {
  const supabase = createAdminClient();
  const today = todayISO();

  const { data: run, error: runError } = await supabase
    .from("job_runs")
    .insert({ job_name: SWEEP_JOB_NAME, status: "running" })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(`Could not open a job run: ${runError?.message}`);
  }

  const summary: SweepSummary = {
    statusesUpdated: 0,
    extractionsRetried: 0,
    remindersCreated: 0,
    emailsSent: 0,
    notificationsCreated: 0,
    escalated: 0,
  };

  try {
    // ── 1. Recompute statuses ────────────────────────────────────────────
    //
    // `expiring` is stored rather than derived so that every screen agrees,
    // which means something has to move a document across the boundary. This
    // is that something.
    const { data: tracked, error: trackedError } = await supabase
      .from("documents")
      .select(
        "id, organization_id, title, type, status, expiry_date, responsible_user_id, subject_id",
      )
      .in("status", ["active", "expiring", "expired"])
      .not("expiry_date", "is", null);

    if (trackedError) {
      throw new Error(`Could not load documents: ${trackedError.message}`);
    }

    for (const document of tracked ?? []) {
      const next = statusFromExpiry(document.expiry_date);
      if (next && next !== document.status) {
        await supabase
          .from("documents")
          .update({ status: next satisfies DocumentStatus })
          .eq("id", document.id)
          .eq("organization_id", document.organization_id);
        summary.statusesUpdated += 1;
      }
    }

    // ── 2. Retry stalled extractions ─────────────────────────────────────
    //
    // A document stuck in `processing` means its event was lost — the queue
    // was unreachable when it was filed, or a deploy interrupted the run.
    // Re-firing is safe: the job's concurrency key prevents a double run.
    const { data: stalled } = await supabase
      .from("documents")
      .select("id, organization_id")
      .in("status", ["processing", "extraction_failed"])
      .lt("updated_at", new Date(Date.now() - 3_600_000).toISOString());

    for (const document of stalled ?? []) {
      try {
        await inngest.send({
          name: "lapse/document.uploaded",
          data: {
            documentId: document.id,
            organizationId: document.organization_id,
          },
        });
        summary.extractionsRetried += 1;
      } catch (error) {
        console.error(`[sweep] could not re-enqueue ${document.id}:`, error);
      }
    }

    // ── 3. Create due reminders ──────────────────────────────────────────
    const { data: forReminders } = await supabase
      .from("documents")
      .select(
        "id, organization_id, title, type, expiry_date, responsible_user_id, subject_id",
      )
      .in("status", ["active", "expiring", "expired"])
      .not("expiry_date", "is", null);

    for (const document of forReminders ?? []) {
      const days = daysUntil(document.expiry_date as string);
      const tier = tierFor(days);
      if (!tier) continue;

      // on_conflict does the idempotency work, so a second run today — or the
      // GitHub Actions backup firing after Vercel Cron already did — inserts
      // nothing rather than sending a duplicate.
      const { data: inserted } = await supabase
        .from("reminders")
        .upsert(
          [
            {
              organization_id: document.organization_id,
              document_id: document.id,
              tier,
              channel: "email" as const,
              scheduled_for: today,
            },
            {
              organization_id: document.organization_id,
              document_id: document.id,
              tier,
              channel: "in_app" as const,
              scheduled_for: today,
            },
          ],
          { onConflict: "document_id,tier,channel", ignoreDuplicates: true },
        )
        .select("id, channel");

      summary.remindersCreated += inserted?.length ?? 0;
    }

    // ── 4. Deliver ───────────────────────────────────────────────────────
    const { data: pending } = await supabase
      .from("reminders")
      .select(
        "id, organization_id, document_id, tier, channel, documents(title, type, expiry_date, responsible_user_id, subjects(label)), organizations(name, slug)",
      )
      .is("sent_at", null);

    for (const reminder of (pending ?? []) as unknown as PendingReminder[]) {
      const document = reminder.documents;
      const organization = reminder.organizations;
      if (!document?.expiry_date || !organization) continue;

      const url = `${appUrl()}/${organization.slug}/documents/${reminder.document_id}`;
      const gap = daysUntil(document.expiry_date);

      if (reminder.channel === "in_app") {
        if (document.responsible_user_id) {
          const { subject, text } = reminderEmail({
            tier: reminder.tier,
            organizationName: organization.name,
            documentTitle: document.title,
            documentType: document.type,
            subjectLabel: document.subjects?.label ?? null,
            expiryDate: document.expiry_date,
            daysUntil: gap,
            url,
          });

          await supabase.from("notifications").insert({
            organization_id: reminder.organization_id,
            user_id: document.responsible_user_id,
            reminder_id: reminder.id,
            title: subject,
            body: text,
            href: `/${organization.slug}/documents/${reminder.document_id}`,
          });
          summary.notificationsCreated += 1;
        }

        await supabase
          .from("reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
        continue;
      }

      // Email
      const email = document.responsible_user_id
        ? await emailFor(document.responsible_user_id)
        : null;

      if (email) {
        const { subject, text } = reminderEmail({
          tier: reminder.tier,
          organizationName: organization.name,
          documentTitle: document.title,
          documentType: document.type,
          subjectLabel: document.subjects?.label ?? null,
          expiryDate: document.expiry_date,
          daysUntil: gap,
          url,
        });

        const result = await sendEmail({ to: email, subject, text });
        if (result.ok) summary.emailsSent += 1;
        else console.error(`[sweep] email for ${reminder.id}:`, result.error);
      }

      // Marked sent regardless. A bounced address should not make the sweep
      // retry the same failing send every day forever — the reminder is still
      // visible in the app, and escalation still applies.
      await supabase
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);
    }

    // ── 5. Escalate ──────────────────────────────────────────────────────
    const cutoff = new Date(
      Date.now() - ESCALATE_AFTER_DAYS * 86_400_000,
    ).toISOString();

    const { data: ignored } = await supabase
      .from("reminders")
      .select(
        "id, organization_id, document_id, documents(title, expiry_date, responsible_user_id), organizations(name, slug)",
      )
      .in("tier", ["t7", "t1", "overdue"])
      .is("acknowledged_at", null)
      .is("escalated_at", null)
      .eq("channel", "email")
      .not("sent_at", "is", null)
      .lt("sent_at", cutoff);

    for (const reminder of (ignored ?? []) as unknown as IgnoredReminder[]) {
      const document = reminder.documents;
      const organization = reminder.organizations;
      if (!document?.expiry_date || !organization) continue;

      const { data: owners } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", reminder.organization_id)
        .eq("role", "owner");

      const responsibleName = document.responsible_user_id
        ? ((await emailFor(document.responsible_user_id)) ?? "someone")
        : "nobody in particular";

      for (const owner of owners ?? []) {
        const ownerEmail = await emailFor(owner.user_id);
        if (!ownerEmail) continue;

        const { subject, text } = escalationEmail({
          organizationName: organization.name,
          documentTitle: document.title,
          responsibleName,
          expiryDate: document.expiry_date,
          daysUntil: daysUntil(document.expiry_date),
          url: `${appUrl()}/${organization.slug}/documents/${reminder.document_id}`,
        });

        await sendEmail({ to: ownerEmail, subject, text });

        await supabase.from("notifications").insert({
          organization_id: reminder.organization_id,
          user_id: owner.user_id,
          reminder_id: reminder.id,
          title: subject,
          body: text,
          href: `/${organization.slug}/documents/${reminder.document_id}`,
        });
      }

      await supabase
        .from("reminders")
        .update({ escalated_at: new Date().toISOString() })
        .eq("id", reminder.id);

      summary.escalated += 1;
    }

    const processed =
      summary.statusesUpdated +
      summary.remindersCreated +
      summary.emailsSent +
      summary.escalated;

    await supabase
      .from("job_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        items_processed: processed,
      })
      .eq("id", run.id);

    return { runId: run.id, summary };
  } catch (error) {
    await supabase
      .from("job_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error.",
      })
      .eq("id", run.id);

    throw error;
  }
}

type PendingReminder = {
  id: string;
  organization_id: string;
  document_id: string;
  tier: ReminderTier;
  channel: "email" | "in_app";
  documents: {
    title: string;
    type: DocumentType;
    expiry_date: string | null;
    responsible_user_id: string | null;
    subjects: { label: string } | null;
  } | null;
  organizations: { name: string; slug: string } | null;
};

type IgnoredReminder = {
  id: string;
  organization_id: string;
  document_id: string;
  documents: {
    title: string;
    expiry_date: string | null;
    responsible_user_id: string | null;
  } | null;
  organizations: { name: string; slug: string } | null;
};

async function emailFor(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? null;
}
