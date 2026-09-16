"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { createDocumentAction } from "@/lib/actions/document.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Subject } from "@/lib/supabase/types";
import {
  ACCEPTED_MIME_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document.schema";

const SELECT_CLASSES =
  "border-input bg-transparent dark:bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function UploadDocumentForm({
  orgSlug,
  subjects,
}: {
  orgSlug: string;
  subjects: Subject[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createDocumentAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="space-y-2">
        <Label htmlFor="file">Document file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          required
          accept={ACCEPTED_MIME_TYPES.join(",")}
          aria-describedby="file-hint"
        />
        <p id="file-hint" className="text-sm text-muted-foreground">
          PDF or image, up to 10 MB.
        </p>
        <FieldError messages={state.fieldErrors?.file} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Document type</Label>
          <select
            id="type"
            name="type"
            className={SELECT_CLASSES}
            defaultValue={DOCUMENT_TYPES[0]}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError messages={state.fieldErrors?.type} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subjectId">
            Covers{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <select id="subjectId" name="subjectId" className={SELECT_CLASSES} defaultValue="">
            <option value="">Not linked to a subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.label}
                {subject.identifier ? ` · ${subject.identifier}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="ABC-1234 registration 2027"
          required
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        <FieldError messages={state.fieldErrors?.title} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="documentNumber">
            Document number{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="documentNumber" name="documentNumber" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issuer">
            Issuer <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="issuer" name="issuer" placeholder="LTO" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issueDate">
            Issued <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="issueDate" name="issueDate" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiryDate">
            Expires <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="expiryDate"
            name="expiryDate"
            type="date"
            aria-invalid={Boolean(state.fieldErrors?.expiryDate)}
            aria-describedby="expiry-hint"
          />
          <p id="expiry-hint" className="text-sm text-muted-foreground">
            Leave blank and Lapse will read it off the document. Anything you
            enter here is taken as correct and skips that.
          </p>
          <FieldError messages={state.fieldErrors?.expiryDate} />
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" />
              Saving
            </>
          ) : (
            "Save document"
          )}
        </Button>
        <Link
          href={`/${orgSlug}/documents`}
          className={buttonVariants({ variant: "ghost" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
