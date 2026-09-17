"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Organization } from "@/lib/supabase/types";

/**
 * Switches between organizations the viewer belongs to.
 *
 * Only rendered when there is more than one — the parent decides that. A
 * switcher with a single entry is a control that cannot do anything, which is
 * why this did not exist until invitations made multiple memberships possible.
 *
 * A native select rather than a dropdown component: it is one list of strings,
 * it works with a keyboard and a screen reader for free, and on a phone it
 * opens the platform picker.
 */
export function OrgSwitcher({
  organizations,
  current,
}: {
  organizations: Organization[];
  current: Organization;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <label
        htmlFor="org-switcher"
        className="text-xs text-muted-foreground"
      >
        Organization
      </label>
      <select
        id="org-switcher"
        value={current.slug}
        disabled={pending}
        onChange={(event) => {
          const slug = event.target.value;
          if (slug === current.slug) return;
          // Always to the dashboard, never the equivalent page in the other
          // organization — a document id from one org is meaningless in
          // another, and landing on a 404 after switching is disorienting.
          startTransition(() => router.push(`/${slug}/dashboard`));
        }}
        className="border-input bg-transparent dark:bg-input/30 h-8 w-full rounded-md border px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-60"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.slug}>
            {organization.name}
          </option>
        ))}
      </select>
    </div>
  );
}
