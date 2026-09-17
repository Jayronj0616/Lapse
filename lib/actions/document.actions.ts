"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import * as documentService from "@/lib/services/document.service";
import * as organizationService from "@/lib/services/organization.service";
import { createDocumentSchema } from "@/lib/validations/document.schema";

import { emptyToNull, text } from "./form-data";
import type { FormState } from "./form-state";

export async function createDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const orgSlug = text(formData.get("orgSlug"));
  const organization = await organizationService.getBySlug(orgSlug);

  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const file = formData.get("file");

  const parsed = createDocumentSchema.safeParse({
    subjectId: emptyToNull(formData.get("subjectId")),
    type: formData.get("type"),
    title: text(formData.get("title")),
    documentNumber: emptyToNull(formData.get("documentNumber")),
    issuer: emptyToNull(formData.get("issuer")),
    issueDate: emptyToNull(formData.get("issueDate")),
    // emptyToNull, not text: an untouched date input submits "", and "" is not
    // a date — it means "not supplied", which is the whole point of the field
    // being optional. Reading it with text() made a blank field fail the ISO
    // regex and report "Use a valid date", which is exactly backwards.
    expiryDate: emptyToNull(formData.get("expiryDate")),
    file,
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await documentService.create({
      organizationId: organization.id,
      ...parsed.data,
    });
  } catch (error) {
    return {
      error:
        error instanceof documentService.DocumentError
          ? error.message
          : "Could not save the document. Try again.",
    };
  }

  revalidatePath(`/${organization.slug}/documents`);
  revalidatePath(`/${organization.slug}/dashboard`);

  redirect(`/${organization.slug}/documents`);
}
