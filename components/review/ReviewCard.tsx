"use client";

import { useActionState, useState } from "react";
import { ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";

import type { FormState } from "@/lib/actions/form-state";
import {
  rejectReviewAction,
  submitReviewAction,
} from "@/lib/actions/review.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReviewItem } from "@/lib/services/review.service";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document.schema";

const SELECT_CLASSES =
  "border-input bg-transparent dark:bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Confidence, shown as the reason this document is here rather than as
 * decoration. The band matters more than the number: a reviewer needs to know
 * at a glance whether to skim or to read every character.
 */
function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="rounded-full bg-status-unknown-bg px-2.5 py-1 text-xs font-medium text-status-unknown">
        No confidence recorded
      </span>
    );
  }

  const percent = Math.round(value * 100);
  const tone =
    value >= 0.8
      ? "bg-status-warn-bg text-status-warn"
      : value >= 0.5
        ? "bg-status-urgent-bg text-status-urgent"
        : "bg-status-expired-bg text-status-expired";

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
        tone,
      )}
    >
      {percent}% confident
    </span>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

export function ReviewCard({
  item,
  fileUrl,
  orgSlug,
}: {
  item: ReviewItem;
  fileUrl: string | null;
  orgSlug: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitReviewAction,
    {},
  );
  const [rejectState, rejectAction, rejecting] = useActionState<
    FormState,
    FormData
  >(rejectReviewAction, {});
  const [showReject, setShowReject] = useState(false);

  // The row disappears from the queue on the next render once handled, but the
  // action returns before that lands. Collapsing immediately stops a reviewer
  // working through a batch from acting on the same document twice.
  if (state.message || rejectState.message) {
    return (
      <article className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {state.message ?? rejectState.message} — {item.title}
      </article>
    );
  }

  const isImage = Boolean(fileUrl) && !item.storage_path.endsWith(".pdf");

  return (
    <article className="overflow-hidden rounded-lg border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">{item.title}</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {item.subject ? `${item.subject.label} · ` : ""}
            {item.extraction
              ? `${item.extraction.provider} ${item.extraction.model}, attempt ${item.extraction.attempt}`
              : "No extraction on record"}
          </p>
        </div>
        <ConfidenceBadge value={item.extraction?.confidence ?? null} />
      </header>

      {/* Source on the left, what the model read on the right. The whole point
          of this screen is that both are visible at once — a reviewer asked to
          remember the document while looking at a form will approve whatever
          is in front of them. */}
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b bg-muted/40 p-4 md:border-b-0 md:border-r">
          {fileUrl ? (
            isImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fileUrl}
                alt={`Scan of ${item.title}`}
                className="max-h-[28rem] w-full rounded-md object-contain"
              />
            ) : (
              <iframe
                src={fileUrl}
                title={`Document: ${item.title}`}
                className="h-[28rem] w-full rounded-md border bg-background"
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              The file could not be loaded.
            </p>
          )}

          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-4" />
              Open full size
            </a>
          ) : null}
        </div>

        <form action={formAction} className="space-y-4 p-4">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="documentId" value={item.id} />

          <div className="space-y-2">
            <Label htmlFor={`type-${item.id}`}>Document type</Label>
            <select
              id={`type-${item.id}`}
              name="type"
              className={SELECT_CLASSES}
              defaultValue={item.type}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`documentNumber-${item.id}`}>Number</Label>
              <Input
                id={`documentNumber-${item.id}`}
                name="documentNumber"
                defaultValue={item.document_number ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`issuer-${item.id}`}>Issuer</Label>
              <Input
                id={`issuer-${item.id}`}
                name="issuer"
                defaultValue={item.issuer ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`issueDate-${item.id}`}>Issued</Label>
              <Input
                id={`issueDate-${item.id}`}
                name="issueDate"
                type="date"
                defaultValue={item.issue_date ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`expiryDate-${item.id}`}>
                Expires
                <span className="ml-1 text-muted-foreground">— required</span>
              </Label>
              <Input
                id={`expiryDate-${item.id}`}
                name="expiryDate"
                type="date"
                required
                defaultValue={item.expiry_date ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.expiryDate)}
              />
              <FieldError messages={state.fieldErrors?.expiryDate} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`note-${item.id}`}>
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id={`note-${item.id}`} name="note" />
          </div>

          {item.extraction?.error ? (
            <p className="flex items-start gap-2 rounded-md bg-status-unknown-bg px-3 py-2 text-sm text-status-unknown">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {item.extraction.error}
            </p>
          ) : null}

          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Approve
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowReject((open) => !open)}
            >
              Reject
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Edit anything the model got wrong before approving — the change is
            recorded against the extraction.
          </p>
        </form>
      </div>

      {showReject ? (
        <form
          action={rejectAction}
          className="flex flex-wrap items-end gap-3 border-t bg-muted/40 p-4"
        >
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="documentId" value={item.id} />

          <div className="min-w-60 flex-1 space-y-2">
            <Label htmlFor={`reject-note-${item.id}`}>
              Why is this being rejected?
            </Label>
            <Input
              id={`reject-note-${item.id}`}
              name="note"
              required
              placeholder="Wrong file, unreadable scan, duplicate…"
              aria-invalid={Boolean(rejectState.fieldErrors?.note)}
            />
            <FieldError messages={rejectState.fieldErrors?.note} />
          </div>

          <Button type="submit" variant="destructive" disabled={rejecting}>
            {rejecting ? <LoaderCircle className="animate-spin" /> : null}
            Reject document
          </Button>

          {rejectState.error ? (
            <p role="alert" className="w-full text-sm text-destructive">
              {rejectState.error}
            </p>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}
