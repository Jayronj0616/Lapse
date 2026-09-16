import "server-only";

import { inngest } from "@/lib/jobs/client";
import { requireUser } from "@/lib/services/auth.service";
import { createClient } from "@/lib/supabase/server";
import type {
  DocumentRow,
  DocumentStatus,
  DocumentType,
  Subject,
} from "@/lib/supabase/types";
import { statusFromExpiry } from "@/lib/utils/status";

export class DocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentError";
  }
}

const BUCKET = "documents";

/** A document with the subject it covers, which is what every screen shows. */
export type DocumentWithSubject = DocumentRow & {
  subject: Pick<Subject, "id" | "label" | "kind" | "identifier"> | null;
};

const SELECT_WITH_SUBJECT =
  "*, subject:subjects(id, label, kind, identifier)" as const;

export async function listForOrganization(
  organizationId: string,
): Promise<DocumentWithSubject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_WITH_SUBJECT)
    .eq("organization_id", organizationId)
    // Nulls last: a document with no expiry yet is not "the most urgent thing
    // in the organization", which is where a naive ascending sort puts it.
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new DocumentError(`Could not load documents: ${error.message}`);
  }

  return (data ?? []) as unknown as DocumentWithSubject[];
}

export async function getById(
  id: string,
): Promise<DocumentWithSubject | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(SELECT_WITH_SUBJECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new DocumentError(`Could not load the document: ${error.message}`);
  }

  return data as unknown as DocumentWithSubject | null;
}

/**
 * A short-lived URL for viewing the stored file.
 *
 * The bucket is private, so there is no permanent link to hand out. Signing
 * happens per request and the URL expires — an insurance policy or a licence
 * scan should not sit on a guessable address indefinitely.
 */
export async function signedFileUrl(
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    throw new DocumentError(
      `Could not produce a link to the file: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.signedUrl;
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;

  const fromType = file.type.split("/").pop()?.toLowerCase();
  return fromType && /^[a-z0-9]{1,5}$/.test(fromType) ? fromType : "bin";
}

export async function create(input: {
  organizationId: string;
  subjectId: string | null;
  type: DocumentType;
  title: string;
  documentNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  file: File;
}): Promise<DocumentRow> {
  const user = await requireUser();
  const supabase = await createClient();

  // The first path segment is what the storage policies check membership
  // against, so it must be the organization id and nothing else.
  const storagePath = `${input.organizationId}/${crypto.randomUUID()}.${extensionFor(input.file)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new DocumentError(`Could not upload the file: ${uploadError.message}`);
  }

  // Two paths, and only two. An expiry the uploader typed is authoritative —
  // the document is tracked immediately and no model is consulted, because
  // there is nothing to work out. Blank means the document waits in
  // `processing` while the extraction job reads it.
  const status: DocumentStatus = input.expiryDate
    ? (statusFromExpiry(input.expiryDate) ?? "active")
    : "processing";

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: input.organizationId,
      subject_id: input.subjectId,
      type: input.type,
      title: input.title,
      storage_path: storagePath,
      status,
      document_number: input.documentNumber,
      issuer: input.issuer,
      issue_date: input.issueDate,
      expiry_date: input.expiryDate,
      uploaded_by: user.id,
      // Whoever files it is answerable for it until somebody reassigns it.
      responsible_user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    // The file is already in storage at this point. Leaving it there would
    // accumulate orphans that nothing references and nothing cleans up.
    await supabase.storage.from(BUCKET).remove([storagePath]);

    throw new DocumentError(`Could not save the document: ${error.message}`);
  }

  if (status === "processing") {
    // Fired after the row exists, so the job always has something to load.
    //
    // A failure to enqueue is logged rather than thrown: the document and its
    // file are saved and perfectly valid, and destroying a successful upload
    // because a queue was briefly unreachable would be the worse outcome. The
    // document sits in `processing`, which the dashboard surfaces, and the
    // daily sweep retries stalled extractions.
    try {
      await inngest.send({
        name: "lapse/document.uploaded",
        data: { documentId: data.id, organizationId: input.organizationId },
      });
    } catch (error) {
      console.error(
        `[documents] could not enqueue extraction for ${data.id}:`,
        error,
      );
    }
  }

  return data;
}
