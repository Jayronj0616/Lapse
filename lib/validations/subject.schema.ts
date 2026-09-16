import { z } from "zod";

export const createSubjectSchema = z.object({
  kind: z.enum(["vehicle", "person"], {
    error: "Choose whether this is a vehicle or a person.",
  }),
  label: z
    .string()
    .trim()
    .min(1, "Give this subject a name.")
    .max(120, "That name is too long."),
  // The plate or licence number. Optional — not everything has one.
  identifier: z
    .string()
    .trim()
    .max(60, "That identifier is too long.")
    .nullable(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
