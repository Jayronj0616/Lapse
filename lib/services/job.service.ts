import "server-only";

import { SWEEP_JOB_NAME } from "@/lib/jobs/sweep";
import { createClient } from "@/lib/supabase/server";
import type { JobRun } from "@/lib/supabase/types";

/** A run is considered stale once it is this far past a daily cadence. */
const STALE_AFTER_HOURS = 36;

export type Heartbeat = {
  lastRun: JobRun | null;
  hoursSince: number | null;
  /**
   * True when the sweep has not completed successfully recently enough.
   *
   * This is the system noticing its own silence. Without it, a broken cron is
   * invisible — the dashboard would simply stop gaining new expiring documents
   * and look reassuringly calm, which is the worst possible failure mode for
   * something whose entire job is to notice deadlines.
   */
  stale: boolean;
};

export async function sweepHeartbeat(): Promise<Heartbeat> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("job_runs")
    .select("*")
    .eq("job_name", SWEEP_JOB_NAME)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { lastRun: null, hoursSince: null, stale: true };
  }

  const reference = data.finished_at ?? data.started_at;
  const hoursSince =
    (Date.now() - new Date(reference).getTime()) / 3_600_000;

  // A run that failed, or one still marked `running` long after it started,
  // both count as stale. The second case is what catches a sweep that crashed
  // hard enough never to write its own failure.
  const stale =
    data.status !== "succeeded" || hoursSince > STALE_AFTER_HOURS;

  return { lastRun: data, hoursSince, stale };
}
