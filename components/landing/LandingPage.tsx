import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CodeXml,
  Database,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { DemoButton } from "@/components/landing/DemoButton";
import { GateExample } from "@/components/landing/GateExample";
import { PipelineFlow } from "@/components/landing/PipelineFlow";
import { buttonVariants } from "@/components/ui/button";

/**
 * The public face, and for this project the only page most visitors will load.
 *
 * Written for the audience that actually arrives here — engineers and hiring
 * managers following a link — not for the trucking company in the example. So
 * it explains the mechanism rather than selling an outcome: what the system
 * does, where it refuses to trust itself, and which decisions were deliberate.
 *
 * Signed-in visitors never see this. `app/page.tsx` routes them to their
 * dashboard before it renders.
 */

const REPO_URL = "https://github.com/Jayronj0616/Lapse";

function Section({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {lead ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {lead}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const DECISIONS = [
  {
    icon: Database,
    title: "Tenancy is enforced by Postgres, not by my code",
    body: "Every table carrying customer data has a row-level policy. An application bug cannot leak another organization's documents, because the database refuses the query — not because a service remembered to add a filter.",
  },
  {
    icon: ScrollText,
    title: "The audit log is written by database triggers",
    body: "No service calls a logger. A trigger records every document and subject change with the acting user attached. A log that depends on being remembered is a log that will eventually have gaps in it.",
  },
  {
    icon: Activity,
    title: "The system reports whether it is still alive",
    body: "The daily pass writes a run record before it does any work. If it stops, the dashboard says so. A deadline watcher that has quietly died looks identical to one with nothing to report — that is the failure worth designing against.",
  },
] as const;

const STACK = [
  ["Framework", "Next.js App Router, TypeScript strict"],
  ["Database", "Supabase Postgres with Row Level Security"],
  ["Extraction", "Vision model behind a provider interface"],
  ["Background work", "Inngest for the pipeline, cron for the daily pass"],
  ["Interface", "Tailwind and shadcn/ui"],
] as const;

export function LandingPage() {
  // Read on the server and never sent to the browser — not the password, and
  // not the address either. Naming the account on a public page invites
  // someone to try it against other services; the button needs neither.
  const hasDemo = Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5" aria-hidden />
          <span className="font-semibold tracking-tight">Lapse</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <CodeXml className="size-4" />
            Source
          </a>
          <Link
            href="/login"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero. One claim, one action, no ornament — the reader decides in
          about fifteen seconds whether to keep going. */}
      {/* Everything between the header and the footer belongs to main.
          Leaving the sections outside it made "skip to main content" reach
          only the hero, and gave the hero a flex-1 box that stretched to the
          full viewport and pushed the rest of the page below the fold. */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Compliance documents expire.
            <span className="block text-muted-foreground">
              Usually nobody notices until it costs something.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Lapse reads permits, registrations and insurance policies, works out
            when each one runs out, and chases the person answerable for it. When
            it is not sure what it has read, it stops and asks a human instead of
            guessing.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {hasDemo ? (
              <DemoButton />
            ) : (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                Read the source
                <ArrowRight className="size-4" />
              </a>
            )}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              <CodeXml className="size-4" />
              Read the source
            </a>
          </div>

          {hasDemo ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Opens a seeded organization with manager access. No sign-up, and
              nothing to type.
            </p>
          ) : null}
        </div>

      <Section
        eyebrow="How it works"
        title="Six stages, one of which is a branch"
        lead="Everything here is a straight line except the third step. That is the only place the system makes a judgement, and the only place it can decide it is not qualified to."
      >
        <PipelineFlow />
      </Section>

      <Section
        eyebrow="The part that matters"
        title="Knowing when not to believe the model"
        lead="Any model will read a date wrong eventually. The question is whether that produces a quiet mistake or a queued task. These two documents took the same path and were treated differently."
      >
        <GateExample />
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The threshold sits above the values models actually report. They
          cluster on round numbers — 0.85, 0.90, 0.95 — so a cut-off placed
          exactly on one of them decides borderline documents by a tie-break
          rather than by anything about the document. A document queued
          needlessly costs someone ten seconds. A wrong expiry date waved
          through costs a fine.
        </p>
      </Section>

      <Section
        eyebrow="Engineering"
        title="Three decisions worth defending"
        lead="Not features. Choices that were made one way rather than another, for reasons."
      >
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {DECISIONS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="bg-background p-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <h3 className="mt-4 text-sm font-medium leading-snug">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="Built with" title="Stack">
        <dl className="divide-y rounded-xl border">
          {STACK.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <dt className="w-44 shrink-0 text-sm text-muted-foreground">
                {label}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      </main>

      <footer className="border-t py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden />
            Lapse — a portfolio project by Jayron Javier
          </div>
          <div className="flex items-center gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <CodeXml className="size-4" />
              GitHub
            </a>
            <Link
              href="/login"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
