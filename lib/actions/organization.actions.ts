"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import * as organizationService from "@/lib/services/organization.service";
import { createOrganizationSchema } from "@/lib/validations/organization.schema";

import type { FormState } from "./form-state";

export async function createOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let slug: string;

  try {
    const organization = await organizationService.create(parsed.data.name);
    slug = organization.slug;
  } catch (error) {
    return {
      error:
        error instanceof organizationService.OrganizationError
          ? error.message
          : "Could not create the organization. Try again.",
    };
  }

  redirect(`/${slug}/dashboard`);
}
