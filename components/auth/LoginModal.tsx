"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "Sign in" from the landing page opens this instead of navigating to
 * `/login` — the marketing page is the only page most visitors load, and a
 * full-page redirect for something as quick as a login form left visitors
 * with no way back to it. `/login` itself still exists for deep links
 * (invite emails, the session-expiry bounce in proxy.ts) — this is just the
 * landing page's entry point into the same form.
 */
export function LoginModal({
  variant = "secondary",
  size = "sm",
  className,
}: {
  variant?: "secondary" | "ghost";
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant={variant} size={size} className={className} />}
      >
        Sign in
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to Lapse</DialogTitle>
        </DialogHeader>
        <LoginForm />
      </DialogContent>
    </Dialog>
  );
}
