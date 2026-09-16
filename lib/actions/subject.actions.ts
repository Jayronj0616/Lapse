"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as organizationService from "@/lib/services/organization.service";
import * as subjectService from "@/lib/services/subject.service";
import { createSubjectSchema } from "@/lib/validations/subject.schema";

import { emptyToNull, text } from "./form-data";
import type { FormState } from "./form-state";

export async function createSubjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // The slug comes from the form, so it is caller-controlled. Resolving it
  // through the service means RLS decides whether this person may see that
  // organization at all — a forged slug simply resolves to nothing.
  const orgSlug = text(formData.get("orgSlug"));
  const organization = await organizationService.getBySlug(orgSlug);

  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = createSubjectSchema.safeParse({
    kind: formData.get("kind"),
    label: text(formData.get("label")),
    identifier: emptyToNull(formData.get("identifier")),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await subjectService.create({
      organizationId: organization.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      identifier: parsed.data.identifier,
    });
  } catch (error) {
    return {
      error:
        error instanceof subjectService.SubjectError
          ? error.message
          : "Could not create the subject. Try again.",
    };
  }

  revalidatePath(`/${organization.slug}/subjects`);
  revalidatePath(`/${organization.slug}/documents`);

  return { message: "Subject added." };
}
