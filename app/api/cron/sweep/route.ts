import { NextResponse, type NextRequest } from "next/server";

import { runSweep } from "@/lib/jobs/sweep";

/**
 * The daily sweep's HTTP entry point.
 *
 * Two independent things call this: Vercel Cron on a schedule, and a GitHub
 * Actions workflow as a backup. The backup is not belt-and-braces caution —
 * this endpoint is also the Supabase keepalive, so if it stops being called
 * the database eventually pauses. A trigger that depends on the same platform
 * as the app is a trigger that fails at the same time as the app.
 *
 * Both callers present CRON_SECRET as a bearer token, which is also the format
 * Vercel Cron sends automatically when that variable is set.
 */

// The sweep sends mail and writes rows; it must never be cached or prerendered.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // Deliberately terse: an unauthenticated caller learns nothing about
    // whether the endpoint exists, what it does, or why they were refused.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId, summary } = await runSweep();
    return NextResponse.json({ ok: true, runId, ...summary });
  } catch (error) {
    // The job_runs row has already been marked failed by runSweep, so the
    // failure is visible in the app even if nobody reads this response.
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sweep failed.",
      },
      { status: 500 },
    );
  }
}
