import { notFound } from "next/navigation";

import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { requireUser } from "@/lib/services/auth.service";
import * as organizationService from "@/lib/services/organization.service";

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

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar organization={organization} userEmail={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar organization={organization} />
        {children}
      </div>
    </div>
  );
}
