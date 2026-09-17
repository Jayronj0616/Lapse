import { cn } from "@/lib/utils";

/**
 * The seven stages, as a numbered grid rather than an arrow chain.
 *
 * A horizontal pipeline with connectors is the obvious illustration and the
 * wrong one here: seven nodes cannot be legible across a phone, and shrinking
 * them to fit makes the labels unreadable at exactly the width most visitors
 * use. Numbering carries the sequence just as well and survives any viewport.
 *
 * Step 3 is styled apart because it is the only branch in the system — the
 * point where the pipeline either continues alone or stops and asks a person.
 * Everything else is a straight line.
 */

type Stage = {
  n: number;
  title: string;
  body: string;
  /** The one stage that is a decision rather than a step. */
  branch?: boolean;
};

const STAGES: readonly Stage[] = [
  {
    n: 1,
    title: "Upload",
    body: "A photo or PDF of a permit, registration or policy, filed against the vehicle or person it covers.",
  },
  {
    n: 2,
    title: "Read",
    body: "A vision model returns the document type, issuer, reference number, issue date and expiry — plus how sure it is.",
  },
  {
    n: 3,
    title: "Decide",
    body: "Confident and coherent, it proceeds. Uncertain, contradictory or implausible, it stops and waits for a human.",
    branch: true,
  },
  {
    n: 4,
    title: "Review",
    body: "The source document beside the extracted fields. What the reviewer changes is recorded against the attempt.",
  },
  {
    n: 5,
    title: "Track",
    body: "Each document carries an expiry date and a person answerable for it.",
  },
  {
    n: 6,
    title: "Remind",
    body: "A daily pass recomputes every state and sends notice at 60, 30, 7 and 1 days — then escalates what nobody acknowledges.",
  },
];

export function PipelineFlow() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {STAGES.map((stage) => (
        <li
          key={stage.n}
          className={cn(
            "bg-background p-6",
            stage.branch && "bg-status-review-bg",
          )}
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                stage.branch
                  ? "bg-status-review text-background"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {stage.n}
            </span>
            <h3
              className={cn(
                "text-sm font-medium",
                stage.branch && "text-status-review",
              )}
            >
              {stage.title}
            </h3>
          </div>
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed text-muted-foreground",
              stage.branch && "text-status-review/90",
            )}
          >
            {stage.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
