import "server-only";

import { Resend } from "resend";

/**
 * Email delivery.
 *
 * Returns a result rather than throwing: a reminder whose email bounced is
 * still a reminder that exists, is visible in the app, and will be escalated
 * if nobody acknowledges it. Letting a mail failure abort the sweep would mean
 * one bad address stopping every other organization's reminders that day.
 */

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  /** Always sent. Clients that block or cannot render HTML show this. */
  text: string;
  html?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "RESEND_API_KEY and REMINDER_FROM_EMAIL must both be set.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Send failed.",
    };
  }
}
