import { Activity, TriangleAlert } from "lucide-react";

import type { Heartbeat } from "@/lib/services/job.service";
import { cn } from "@/lib/utils";

function describeAge(hours: number | null): string {
  if (hours === null) return "never";
  if (hours < 1) return "less than an hour ago";
  if (hours < 2) return "an hour ago";
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * Whether the automation is actually alive.
 *
 * A stale heartbeat is treated as an exception in its own right, alongside the
 * expiring documents. If the sweep stops running, nothing else on this page
 * goes wrong-looking — it just quietly stops changing, which reads as "all
 * clear" instead of "the thing that watches deadlines is dead".
 */
export function HeartbeatIndicator({ heartbeat }: { heartbeat: Heartbeat }) {
  const { lastRun, hoursSince, stale } = heartbeat;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        stale && "border-status-expired/40 bg-status-expired-bg",
      )}
    >
      {stale ? (
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-status-expired"
          aria-hidden
        />
      ) : (
        <Activity
          className="mt-0.5 size-4 shrink-0 text-status-ok"
          aria-hidden
        />
      )}

      <div className="min-w-0">
        {stale ? (
          <>
            <p className="font-medium text-status-expired">
              The daily check is not running
            </p>
            <p className="mt-0.5 text-status-expired/90">
              {lastRun === null
                ? "It has never run. Reminders are not being sent and nothing is being re-checked."
                : `Last completed ${describeAge(hoursSince)}${lastRun.error ? ` — ${lastRun.error}` : ""}. Until it runs again, expiry dates on this page are not being refreshed.`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Daily check ran {describeAge(hoursSince)}
            {lastRun ? ` · ${lastRun.items_processed} items` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
