import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";

import { NavLink } from "@/components/layout/NavLink";
import { signOutAction } from "@/lib/actions/auth.actions";
import type { Organization } from "@/lib/supabase/types";

/**
 * Only routes that exist appear here. As each phase lands its screens —.
 * documents, review, subjects, audit, settings — the link is added then, not
 * now as a dead entry.
 */
export function Sidebar({
  organization,
  userEmail,
}: {
  organization: Organization;
  userEmail: string;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <ShieldCheck className="size-5" aria-hidden />
        <span className="font-semibold tracking-tight">Lapse</span>
      </div>

      <div className="border-y px-4 py-3">
        <p className="text-xs text-muted-foreground">Organization</p>
        <p className="truncate text-sm font-medium" title={organization.name}>
          {organization.name}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavLink
          href={`/${organization.slug}/dashboard`}
          icon={LayoutDashboard}
        >
          Dashboard
        </NavLink>
      </nav>

      <div className="border-t p-3">
        <p
          className="truncate px-3 pb-2 text-xs text-muted-foreground"
          title={userEmail}
        >
          {userEmail}
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
