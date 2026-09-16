import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellOff } from "lucide-react";

import { NotificationRow } from "@/components/notifications/NotificationRow";
import * as notificationService from "@/lib/services/notification.service";
import * as organizationService from "@/lib/services/organization.service";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage({
  params,
}: PageProps<"/[orgSlug]/notifications">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const notifications = await notificationService.listForUser(organization.id);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reminders addressed to you. Acknowledging one records that you saw it
        and stops it escalating to the organization&rsquo;s owner.
      </p>

      {notifications.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <BellOff className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium">Nothing for you yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When a document you are responsible for approaches its expiry, the
            daily check will tell you here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              orgSlug={organization.slug}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
