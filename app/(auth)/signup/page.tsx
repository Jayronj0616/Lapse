import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignUpPage({
  searchParams,
}: PageProps<"/signup">) {
  const { invite } = await searchParams;

  return <SignUpForm invite={typeof invite === "string" ? invite : undefined} />;
}
