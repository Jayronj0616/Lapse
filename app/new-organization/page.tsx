import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { CreateOrganizationForm } from "@/components/organizations/CreateOrganizationForm";
import * as organizationService from "@/lib/services/organization.service";

export const metadata: Metadata = {
  title: "New organization",
};

export default async function NewOrganizationPage() {
  // Someone who already has an organization does not belong on an onboarding
  // screen. They can still create another one from settings later.
  const organizations = await organizationService.listMine();
  if (organizations.length > 0) {
    redirect(`/${organizations[0].slug}/dashboard`);
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Building2 className="size-7" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your organization
          </h1>
          <p className="text-sm text-muted-foreground">
            Documents, people and reminders all live inside an organization.
            You will be its owner.
          </p>
        </div>
        <CreateOrganizationForm />
      </div>
    </main>
  );
}
