import { LogOut, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth.actions";
import type { Organization } from "@/lib/supabase/types";

/**
 * The sidebar is desktop-only, so without this the app would have no chrome at
 * all on a phone. A bottom tab bar is the plan once there is more than one
 * destination to tab between — see DESIGN.md.
 */
export function MobileTopBar({ organization }: { organization: Organization }) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        <span className="truncate text-sm font-medium">
          {organization.name}
        </span>
      </div>

      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}
