import { Check, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The same upload path, two outcomes.
 *
 * This is the page's centrepiece because the gate is the only part of the
 * system that is genuinely difficult. Calling a model is easy; deciding when
 * not to believe it is the work.
 *
 * Shown as two records rather than a chart. Two numbers do not need a
 * visualisation, and inventing a bar-and-axis grammar for them would introduce
 * a second visual language on a page whose job is to look like the product.
 * The chips are the same vocabulary the application itself uses for status.
 */

type Field = { label: string; value: string; doubtful?: boolean };

const ACCEPTED: Field[] = [
  { label: "Type", value: "Vehicle registration" },
  { label: "Number", value: "CR-2025-0047821" },
  { label: "Issued", value: "24 September 2025" },
  { label: "Expires", value: "24 September 2026" },
];

const QUEUED: Field[] = [
  { label: "Type", value: "Vehicle registration" },
  { label: "Number", value: "CR-2O25-OO479l3" },
  { label: "Issued", value: "11/09/25 → 11 Sept 2025" },
  { label: "Expires", value: "03/04/27 → 3 April 2027?", doubtful: true },
];

function Fields({ fields }: { fields: Field[] }) {
  return (
    <dl className="mt-5 space-y-2.5">
      {fields.map((field) => (
        <div key={field.label} className="flex items-baseline gap-3 text-sm">
          <dt className="w-20 shrink-0 text-muted-foreground">{field.label}</dt>
          <dd
            className={cn(
              "min-w-0 break-words",
              field.doubtful &&
                "rounded bg-status-review-bg px-1.5 py-0.5 font-medium text-status-review",
            )}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function GateExample() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Accepted */}
      <article className="rounded-xl border p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">A clean scan</p>
          <span className="rounded-full bg-status-ok-bg px-2.5 py-1 text-xs font-medium tabular-nums text-status-ok">
            96% confident
          </span>
        </div>

        <Fields fields={ACCEPTED} />

        <p className="mt-6 flex items-start gap-2 border-t pt-4 text-sm text-status-ok">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Tracked automatically.</span> Nobody
            typed a date, and nobody had to check it.
          </span>
        </p>
      </article>

      {/* Sent to review */}
      <article className="rounded-xl border border-status-review/30 p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">A faded photocopy</p>
          <span className="rounded-full bg-status-review-bg px-2.5 py-1 text-xs font-medium tabular-nums text-status-review">
            85% confident
          </span>
        </div>

        <Fields fields={QUEUED} />

        <p className="mt-6 flex items-start gap-2 border-t pt-4 text-sm text-status-review">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Held for a person.</span> The date
            could be 3 April or 4 March and nothing on the page settles it, so
            the system refuses to pick.
          </span>
        </p>
      </article>
    </div>
  );
}
