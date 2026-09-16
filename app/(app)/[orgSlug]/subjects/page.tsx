import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Truck, User } from "lucide-react";

import { CreateSubjectForm } from "@/components/subjects/CreateSubjectForm";
import * as organizationService from "@/lib/services/organization.service";
import * as subjectService from "@/lib/services/subject.service";

export const metadata: Metadata = {
  title: "Subjects",
};

export default async function SubjectsPage({
  params,
}: PageProps<"/[orgSlug]/subjects">) {
  const { orgSlug } = await params;

  const organization = await organizationService.getBySlug(orgSlug);
  if (!organization) notFound();

  const subjects = await subjectService.listForOrganization(organization.id);

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The vehicles and people your documents are about. A registration
        belongs to a truck; a licence belongs to a driver.
      </p>

      <div className="mt-8 rounded-lg border p-4">
        <CreateSubjectForm orgSlug={organization.slug} />
      </div>

      {subjects.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Truck className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium">No subjects yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add a vehicle or a person above, then file documents against it.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              {subject.kind === "vehicle" ? (
                <Truck className="size-4 text-muted-foreground" aria-hidden />
              ) : (
                <User className="size-4 text-muted-foreground" aria-hidden />
              )}
              <span className="text-sm font-medium">{subject.label}</span>
              {subject.identifier ? (
                <span className="text-sm text-muted-foreground">
                  {subject.identifier}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
