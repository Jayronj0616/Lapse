import { notFound } from "next/navigation";

import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/services/auth.service";
import * as organizationService from "@/lib/services/organization.service";
import * as notificationService from "@/lib/services/notification.service";
import * as reviewService from "@/lib/services/review.service";

export default async function OrganizationLayout({
  children,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;

  const [user, organization] = await Promise.all([
    requireUser(),
    organizationService.getBySlug(orgSlug),
  ]);

  // RLS makes "no such organization" and "you are not a member of it"
  // indistinguishable, and that is deliberate — a 404 either way tells an
  // outsider nothing about which organizations exist.
  if (!organization) notFound();

  // Drives which navigation the viewer sees. Never an authorization decision
  // on its own — every policy is enforced in the database regardless of what
  // the sidebar chose to render.
  const [role, reviewCount, unreadCount, organizations] = await Promise.all([
    organizationService.roleIn(organization.id),
    reviewService.countPending(organization.id),
    notificationService.countUnread(organization.id),
    organizationService.listMine(),
  ]);

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        organization={organization}
        role={role}
        userEmail={user.email ?? ""}
        reviewCount={reviewCount}
        unreadCount={unreadCount}
        organizations={organizations}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar organization={organization} />
        {children}
      </div>
    </div>
  );
}
