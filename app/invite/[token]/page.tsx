import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CircleAlert } from "lucide-react";

import { AcceptInvitationForm } from "@/components/members/AcceptInvitationForm";
import { signOutToInviteAction } from "@/lib/actions/membership.actions";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/services/auth.service";
import * as membershipService from "@/lib/services/membership.service";

export const metadata: Metadata = {
  title: "Invitation",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

/**
 * The invitation landing page.
 *
 * Has to work in three states, which is why it is not simply behind the auth
 * guard: a stranger following the link for the first time, someone who already
 * has an account but is signed out, and someone already signed in.
 *
 * The preview comes from a `SECURITY DEFINER` function callable by anon and
 * returns only the organization's name and the invited address — a leaked
 * token should reveal as little as possible.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;

  const [invitation, user] = await Promise.all([
    membershipService.previewInvitation(token),
    getCurrentUser(),
  ]);

  if (!invitation) {
    return (
      <Shell>
        <CircleAlert className="mx-auto size-7 text-status-expired" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          That link is not valid
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been revoked, or the address may have been mistyped. Ask
          whoever invited you to send a new one.
        </p>
      </Shell>
    );
  }

  if (!invitation.valid) {
    return (
      <Shell>
        <CircleAlert className="mx-auto size-7 text-status-warn" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          This invitation is no longer open
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It has either been used already or passed its expiry. Ask{" "}
          {invitation.organizationName} for a fresh invitation.
        </p>
        <Link href="/login" className={buttonVariants({ className: "mt-6" })}>
          Go to sign in
        </Link>
      </Shell>
    );
  }

  // Signed in, but as somebody else. Accepting would fail in the database
  // anyway — the function requires the addresses to match — so say so plainly
  // rather than letting them press a button that cannot work.
  const wrongAccount =
    user !== null && user.email?.toLowerCase() !== invitation.email;

  return (
    <Shell>
      <Building2 className="mx-auto size-7" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Join {invitation.organizationName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This invitation was sent to{" "}
        <span className="text-foreground">{invitation.email}</span>.
      </p>

      <div className="mt-8 text-left">
        {user === null ? (
          <div className="space-y-3">
            <Link
              href={`/signup?invite=${token}`}
              className={buttonVariants({ className: "w-full" })}
            >
              Create an account and join
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className={buttonVariants({
                variant: "secondary",
                className: "w-full",
              })}
            >
              I already have an account
            </Link>
          </div>
        ) : wrongAccount ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              You are signed in as{" "}
              <span className="text-foreground">{user.email}</span>, but this
              invitation is for a different address. Sign out and sign back in
              as {invitation.email}.
            </p>
            <form action={signOutToInviteAction}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className={buttonVariants({
                  variant: "secondary",
                  className: "w-full",
                })}
              >
                Sign out and come back here
              </button>
            </form>
          </div>
        ) : (
          <AcceptInvitationForm
            token={token}
            organizationName={invitation.organizationName}
          />
        )}
      </div>
    </Shell>
  );
}
