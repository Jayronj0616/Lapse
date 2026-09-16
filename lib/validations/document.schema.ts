import { z } from "zod";

/** Mirrors the bucket's own limits in migration 0002. Keep the two in step. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const DOCUMENT_TYPES = [
  "vehicle_registration",
  "insurance_policy",
  "drivers_license",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<
  (typeof DOCUMENT_TYPES)[number],
  string
> = {
  vehicle_registration: "Vehicle registration",
  insurance_policy: "Insurance policy",
  drivers_license: "Driver's licence",
};

/** "YYYY-MM-DD", the shape a Postgres `date` column and an `<input type=date>` agree on. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

export const createDocumentSchema = z
  .object({
    subjectId: z.uuid("Choose a valid subject.").nullable(),
    type: z.enum(DOCUMENT_TYPES, { error: "Choose a document type." }),
    title: z
      .string()
      .trim()
      .min(1, "Give this document a title.")
      .max(200, "That title is too long."),
    documentNumber: z.string().trim().max(120).nullable(),
    issuer: z.string().trim().max(120).nullable(),
    issueDate: isoDate.nullable(),
    // Required in Phase 2: a person is typing it, and a document with no
    // expiry date is not something this system can do anything useful with.
    // Phase 3 relaxes this, because extraction can legitimately fail to find one.
    expiryDate: isoDate,
    file: z
      .instanceof(File, { error: "Attach the document file." })
      .refine((file) => file.size > 0, "Attach the document file.")
      .refine(
        (file) => file.size <= MAX_FILE_BYTES,
        "That file is larger than 10 MB.",
      )
      .refine(
        (file) =>
          (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type),
        "Upload a PDF or an image.",
      ),
  })
  // ISO date strings compare correctly as plain strings, so this needs no date
  // parsing — and therefore cannot drift across a timezone boundary.
  .refine(
    (data) => !data.issueDate || data.expiryDate >= data.issueDate,
    {
      error: "The expiry date cannot be before the issue date.",
      path: ["expiryDate"],
    },
  );

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
