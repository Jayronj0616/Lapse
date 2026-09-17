#!/usr/bin/env node
/**
 * Seeds an admin account and an organization for it to own.
 *
 * Run with:  pnpm seed:admin
 *
 * Every value comes from the environment, nothing is hardcoded — this repo is
 * public, and a committed admin password is found by scrapers within hours.
 *
 * Uses the Supabase Admin API rather than the normal sign-up path, for two
 * reasons: it can set `email_confirm` so a fake domain like @lapse.com works
 * without a deliverable inbox, and it can create the organization and the
 * owner membership in the same run. The `create_organization()` function is
 * not usable here — it reads `auth.uid()`, which is null for the service role.
 *
 * Safe to run more than once. An existing account is reused rather than
 * duplicated, and an existing organization is left alone.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const fullName = process.env.SEED_ADMIN_NAME ?? "Admin";
const orgName = process.env.SEED_ORG_NAME ?? "Demo Organization";

const missing = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secret,
  SEED_ADMIN_EMAIL: email,
  SEED_ADMIN_PASSWORD: password,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env.local and fill in the SEED_ values.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function slugify(value) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "org"
  );
}

async function findUserByEmail(address) {
  // listUsers is paginated and has no server-side email filter, so this walks
  // pages. Fine for a seed script against a small project; it would not be
  // fine in application code.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === address.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  let user = await findUserByEmail(email);

  if (user) {
    console.log(`• Account already exists: ${email}`);
    // Reset the password so a stale seeded account still matches whatever is
    // currently in .env.local.
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not update the account: ${error.message}`);
    console.log("  password reset to the current SEED_ADMIN_PASSWORD");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      // Skips the confirmation email entirely, which is what makes a
      // non-deliverable address like @lapse.com usable.
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`Could not create the account: ${error.message}`);
    user = data.user;
    console.log(`✓ Created account: ${email}`);
  }

  // The handle_new_user trigger populates profiles, but it fires on insert
  // only — an account created before that trigger existed would have no row.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw new Error(`Could not upsert the profile: ${profileError.message}`);
  }

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("organization_id, organizations(name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership?.organizations) {
    console.log(
      `• Already owns an organization: ${existingMembership.organizations.name} (/${existingMembership.organizations.slug})`,
    );
    report(existingMembership.organizations.slug);
    return;
  }

  const slug = slugify(orgName);

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: orgName, slug })
    .select()
    .single();

  if (orgError) {
    throw new Error(`Could not create the organization: ${orgError.message}`);
  }

  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "owner",
    });

  if (membershipError) {
    throw new Error(`Could not create the membership: ${membershipError.message}`);
  }

  console.log(`✓ Created organization: ${orgName} (/${organization.slug})`);
  report(organization.slug);
}

function report(slug) {
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log("");
  console.log("Sign in at:", `${app}/login`);
  console.log("Email:     ", email);
  console.log("Password:   (the value of SEED_ADMIN_PASSWORD)");
  console.log("Dashboard: ", `${app}/${slug}/dashboard`);
}

main().catch((error) => {
  console.error("");
  console.error("Seed failed:", error.message);
  process.exit(1);
});
