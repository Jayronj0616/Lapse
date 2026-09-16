import { z } from "zod";

export const createOrganizationSchema = z.object({
  // Matches the CHECK constraint on organizations.name, so a value that passes
  // here cannot fail at the database with an opaque error.
  name: z
    .string()
    .trim()
    .min(2, "Enter your organization's name.")
    .max(120, "That name is too long."),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
