"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Client only because it needs `usePathname` for the active state. Kept as a
 * leaf so the sidebar around it stays a Server Component.
 *
 * `icon` takes an already-rendered element, not a component. A component is a
 * function, and functions cannot cross the server/client boundary — passing
 * `icon={LayoutDashboard}` from a Server Component throws at runtime with
 * "Functions cannot be passed directly to Client Components". TypeScript
 * cannot catch it, because it is a serialization rule rather than a type rule.
 */
export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  /** A count worth acting on. Omitted or zero renders nothing at all. */
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon}
      {children}
      {badge ? (
        <span className="ml-auto rounded-full bg-status-review-bg px-2 py-0.5 text-xs font-medium tabular-nums text-status-review">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
