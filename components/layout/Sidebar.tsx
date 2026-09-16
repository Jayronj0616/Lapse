import {
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { NavLink } from "@/components/layout/NavLink";
import { signOutAction } from "@/lib/actions/auth.actions";
import type { MemberRole, Organization } from "@/lib/supabase/types";

/**
 * Only routes that exist appear here, and only those the viewer can actually
 * use. The audit log is readable by owners and managers, so staff do not get a
 * link to a page that would render empty for them by policy.
 *
 * Review, settings and members are added by the phases that build them.
 */
export function Sidebar({
  organization,
  role,
  userEmail,
}: {
  organization: Organization;
  role: MemberRole | null;
  userEmail: string;
}) {
  const base = `/${organization.slug}`;
  const canSeeAudit = role === "owner" || role === "manager";

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
        <NavLink href={`${base}/dashboard`} icon={LayoutDashboard}>
          Dashboard
        </NavLink>
        <NavLink href={`${base}/documents`} icon={FileText}>
          Documents
        </NavLink>
        <NavLink href={`${base}/subjects`} icon={Truck}>
          Subjects
        </NavLink>
        {canSeeAudit ? (
          <NavLink href={`${base}/audit`} icon={ScrollText}>
            Audit log
          </NavLink>
        ) : null}
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
