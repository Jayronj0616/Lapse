"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as organizationService from "@/lib/services/organization.service";
import * as reviewService from "@/lib/services/review.service";
import {
  rejectReviewSchema,
  submitReviewSchema,
} from "@/lib/validations/review.schema";

import { emptyToNull, text } from "./form-data";
import type { FormState } from "./form-state";

async function resolveOrganization(formData: FormData) {
  const orgSlug = text(formData.get("orgSlug"));
  return organizationService.getBySlug(orgSlug);
}

function revalidate(slug: string) {
  revalidatePath(`/${slug}/review`);
  revalidatePath(`/${slug}/documents`);
  revalidatePath(`/${slug}/dashboard`);
}

export async function submitReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await resolveOrganization(formData);
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = submitReviewSchema.safeParse({
    documentId: text(formData.get("documentId")),
    type: formData.get("type"),
    documentNumber: emptyToNull(formData.get("documentNumber")),
    issuer: emptyToNull(formData.get("issuer")),
    issueDate: emptyToNull(formData.get("issueDate")),
    expiryDate: text(formData.get("expiryDate")),
    note: emptyToNull(formData.get("note")),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await reviewService.submit(organization.id, parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof reviewService.ReviewError
          ? error.message
          : "Could not save the review. Try again.",
    };
  }

  revalidate(organization.slug);
  return { message: "Review saved." };
}

export async function rejectReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await resolveOrganization(formData);
  if (!organization) {
    return { error: "That organization is not available to you." };
  }

  const parsed = rejectReviewSchema.safeParse({
    documentId: text(formData.get("documentId")),
    note: text(formData.get("note")),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await reviewService.reject(organization.id, parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof reviewService.ReviewError
          ? error.message
          : "Could not reject the document. Try again.",
    };
  }

  revalidate(organization.slug);
  return { message: "Document rejected." };
}
