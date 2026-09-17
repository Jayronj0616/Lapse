import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, email } = await searchParams;

  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      // Prefilled from the landing page's demo button. Only ever the address —
      // a password in a URL ends up in browser history and server logs, and the
      // demo password is one click to copy from the page it came from.
      email={typeof email === "string" ? email : undefined}
    />
  );
}
