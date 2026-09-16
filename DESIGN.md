# DESIGN.md — design system

Read before writing any class. No hardcoded colors, ever — if a value isn't a token here, add it as a token rather than inlining it.

---

## Principles

**The dashboard is a triage screen, not a report.** Its job is to answer "what needs a human right now" above the fold. Anything that isn't actionable belongs on a different page.

**Severity is carried by color *and* something else.** Never color alone — a red chip also says "Expired", an amber one says "12 days". Colorblind users and grayscale printouts both have to work.

**Calm by default.** Most documents are fine most of the time. If everything is loud, nothing is. Neutral is the default state; color is reserved for things that need attention.

---

## Tokens

This project uses **Tailwind v4**, which is CSS-first: there is no `tailwind.config.ts`. Everything is declared in `app/globals.css`.

That file has two halves. The top is shadcn's — it owns the base tokens and will be rewritten if shadcn regenerates. The bottom is a clearly marked **Lapse status tokens** block that shadcn does not touch. Add project tokens there, never in shadcn's half.

A token becomes a utility class by being mapped inside `@theme inline`. `--status-urgent` mapped as `--color-status-urgent` is what makes `text-status-urgent` and `bg-status-urgent-bg` exist. Declaring the variable without the mapping gives you a variable no class can reach.

Dark mode redefines the same names under `.dark` — no component ever branches on theme.

### Base

| Token | Role |
|---|---|
| `background` / `foreground` | Page surface and primary text |
| `card` / `card-foreground` | Raised surfaces |
| `muted` / `muted-foreground` | Secondary surfaces, supporting text |
| `border` / `input` / `ring` | Edges and focus |
| `primary` / `primary-foreground` | Primary action |
| `secondary` / `secondary-foreground` | Secondary action |
| `accent` / `accent-foreground` | Hover, selected rows |
| `destructive` / `destructive-foreground` | Delete, reject |

Standard shadcn set — keep it, don't rename it.

### Status

This is the project-specific layer. Every expiry state maps to exactly one token pair.

| Token | Meaning | Where it appears |
|---|---|---|
| `status-ok` | Active, more than 60 days out | Green family |
| `status-soon` | Expiring, 31–60 days | Blue family — informational, not alarming |
| `status-warn` | Expiring, 8–30 days | Amber |
| `status-urgent` | Expiring, 7 days or fewer | Orange |
| `status-expired` | Past expiry | Red |
| `status-review` | Awaiting human review | Violet — distinct from the time scale, it's a *different kind* of problem |
| `status-unknown` | Processing, extraction failed | Neutral gray |

Each has a `-fg` (text) and a `-bg` (chip background) variant, so a chip is never a raw color with opacity guessed at the call site.

Two things to hold onto: `status-review` is deliberately off the red-to-green scale, because "the model wasn't sure" is not a severity, it's a category. And `status-soon` is blue rather than pale green — a document 45 days out is *information*, and green would read as "no action needed".

---

## Typography

Poppins throughout, via `next/font`.

| Use | Treatment |
|---|---|
| Page title | `text-2xl font-semibold tracking-tight` |
| Section heading | `text-lg font-medium` |
| Body | `text-sm` |
| Supporting / metadata | `text-sm text-muted-foreground` |
| Numeric emphasis (days remaining) | `text-2xl font-semibold tabular-nums` |

`tabular-nums` on anything counting down — otherwise the digits jitter between renders.

---

## Components

shadcn/ui, installed unmodified into `components/ui/`. Never edit those files directly; wrap them in `components/{module}/` when behavior needs to change.

Icons: `lucide-react` only. One icon per concept across the whole app — a document is always `FileText`, a vehicle is always `Truck`, an expiry is always `CalendarClock`.

### Patterns worth being consistent about

**Status chip.** Rendered only by `StatusBadge.tsx`. Shape: colored dot, status label, then the day count when one applies. Every other component imports it rather than mapping status to color itself.

**Empty states.** Every list gets one: an icon, a sentence saying what would be here, and the action that creates the first item. "No documents found" with nothing else is not acceptable.

**Loading.** Skeletons matching the real layout's shape, not spinners. A table skeleton has rows.

**Destructive confirmation.** Delete and reject open a dialog naming the specific item. No bare `confirm()`.

**The review screen.** Source document on the left at readable size, extracted fields on the right, each field showing its confidence. A field below threshold is visually marked so the reviewer's eye goes there first. This screen is the product's most interesting moment — it deserves more care than anything else in the app.

---

## Layout

- Sidebar navigation on desktop, bottom tab bar under `md`.
- Content max width `max-w-7xl`, page padding `px-4 md:px-6 lg:px-8`.
- Dashboard exception groups stack in one column on mobile, two on `lg`. Ordered by severity, most urgent first — never alphabetically.
- Tables collapse to cards under `md`. A horizontally scrolling table on a phone is a failure.

---

## Dark mode

Supported from the start, not retrofitted. Every token pair is defined under both themes, and a component that reads correctly in one must read correctly in the other. Check status chips specifically — saturated colors that work on white often vibrate on a dark surface and need their dark-mode variants desaturated.
