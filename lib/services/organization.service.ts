import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Organization } from "@/lib/supabase/types";
import { slugSuffix, slugify } from "@/lib/utils/slug";

export class OrganizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationError";
  }
}

/**
 * Every organization the caller belongs to.
 *
 * Note the absence of a filter. The RLS policy on `organizations` is
 * `is_member_of(id)`, so an unqualified select already returns exactly the
 * caller's organizations — the database does the scoping, not this function.
 * This is the pattern the whole project rests on; resist adding a redundant
 * `.eq()` here, because doing so teaches the next reader that the filter is
 * what protects the data.
 */
export async function listMine(): Promise<Organization[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new OrganizationError(
      `Could not load organizations: ${error.message}`,
    );
  }

  return data ?? [];
}

/** One organization by slug, or null when it does not exist *or* the caller is not a member — RLS makes those indistinguishable, which is the point. */
export async function getBySlug(slug: string): Promise<Organization | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new OrganizationError(
      `Could not load organization: ${error.message}`,
    );
  }

  return data;
}

/** The caller's role in an organization, or null if they are not a member. */
export async function roleIn(
  organizationId: string,
): Promise<MemberRole | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("role_in", {
    org: organizationId,
  });

  if (error) {
    throw new OrganizationError(`Could not resolve role: ${error.message}`);
  }

  return data ?? null;
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" || Boolean(error.message?.includes("duplicate key"))
  );
}

/**
 * Creates an organization and makes the caller its owner.
 *
 * Delegates to the `create_organization` database function rather than
 * inserting directly — see the migration for why. The slug is derived from the
 * name and retried with a suffix on collision, because two customers are quite
 * likely to both be called "Northern Freight".
 */
export async function create(name: string): Promise<Organization> {
  const supabase = await createClient();
  const base = slugify(name);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${slugSuffix()}`;

    const { data, error } = await supabase.rpc("create_organization", {
      org_name: name,
      org_slug: slug,
    });

    if (!error) return data;

    if (!isUniqueViolation(error)) {
      throw new OrganizationError(
        `Could not create the organization: ${error.message}`,
      );
    }
  }

  throw new OrganizationError(
    "Could not find an available URL for that name. Try a different one.",
  );
}
