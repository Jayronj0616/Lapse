"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check, LoaderCircle } from "lucide-react";

import {
  acknowledgeReminderAction,
  markNotificationReadAction,
} from "@/lib/actions/notification.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import type { NotificationWithReminder } from "@/lib/services/notification.service";
import { cn } from "@/lib/utils";

export function NotificationRow({
  notification,
  orgSlug,
}: {
  notification: NotificationWithReminder;
  orgSlug: string;
}) {
  const [ackState, acknowledge, acknowledging] = useActionState<
    FormState,
    FormData
  >(acknowledgeReminderAction, {});
  const [, markRead, markingRead] = useActionState<FormState, FormData>(
    markNotificationReadAction,
    {},
  );

  const unread = notification.read_at === null;
  const canAcknowledge =
    notification.reminder !== null &&
    notification.reminder.acknowledged_at === null &&
    !ackState.message;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between",
        unread && "bg-accent/40",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {unread ? (
            <span
              className="mr-2 inline-block size-1.5 rounded-full bg-status-review align-middle"
              aria-label="Unread"
            />
          ) : null}
          {notification.title}
        </p>
        {notification.href ? (
          <Link
            href={notification.href}
            className="mt-1 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open the document
          </Link>
        ) : null}
        {ackState.error ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {ackState.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canAcknowledge ? (
          <form action={acknowledge}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input
              type="hidden"
              name="reminderId"
              value={notification.reminder?.id ?? ""}
            />
            <input
              type="hidden"
              name="notificationId"
              value={notification.id}
            />
            <Button type="submit" size="sm" disabled={acknowledging}>
              {acknowledging ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Acknowledge
            </Button>
          </form>
        ) : notification.reminder?.acknowledged_at || ackState.message ? (
          <span className="text-sm text-muted-foreground">Acknowledged</span>
        ) : null}

        {unread ? (
          <form action={markRead}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input
              type="hidden"
              name="notificationId"
              value={notification.id}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={markingRead}
            >
              Mark read
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
