#!/usr/bin/env node
/**
 * Seeds the public demo: an account, an organization, and a fleet whose
 * documents land in every state the dashboard can show.
 *
 * Run with:  pnpm seed:demo
 *
 * Two deliberate choices about who owns what:
 *
 *   - The **admin account owns** the demo organization. The demo account is
 *     only a **manager**. Anyone reading the landing page can sign in as the
 *     demo user, and an owner can delete the organization, remove members and
 *     change roles. A manager can do everything worth showing and none of that.
 *
 *   - It **resets** rather than appends. Visitors can edit and delete things,
 *     so re-running this restores a known state instead of piling up a second
 *     copy of the fleet.
 *
 * Expiry dates are computed relative to today, so the demo never goes stale —
 * hardcoded dates would drift into "everything expired two years ago" and make
 * the dashboard look broken rather than urgent.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.SEED_DEMO_EMAIL;
const password = process.env.SEED_DEMO_PASSWORD;
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const orgName = process.env.SEED_DEMO_ORG ?? "Luzon Freight Lines";

const missing = Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secret,
  SEED_DEMO_EMAIL: email,
  SEED_DEMO_PASSWORD: password,
  SEED_ADMIN_EMAIL: adminEmail,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("See .env.example for what each one is for.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "documents";

/** "YYYY-MM-DD", `days` from today, in UTC calendar days like the app itself. */
function dateIn(days) {
  const now = new Date();
  const utc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days,
  );
  return new Date(utc).toISOString().slice(0, 10);
}

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

async function ensureDemoUser() {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not update the demo user: ${error.message}`);
    console.log(`• Demo account exists: ${email} (password reset)`);
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Demo User" },
  });
  if (error) throw new Error(`Could not create the demo user: ${error.message}`);
  console.log(`✓ Created demo account: ${email}`);
  return data.user;
}

async function ensureOrganization(ownerId, demoUserId) {
  const slug = slugify(orgName);

  const { data: existing } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const organization =
    existing ??
    (await supabase
      .from("organizations")
      .insert({ name: orgName, slug })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw new Error(`Could not create the org: ${error.message}`);
        console.log(`✓ Created organization: ${orgName} (/${slug})`);
        return data;
      }));

  if (existing) console.log(`• Organization exists: ${orgName} (/${slug})`);

  // The admin owns it; the demo user is only a manager. guard_last_owner also
  // means the org can never be left without an administrator.
  await supabase
    .from("memberships")
    .upsert(
      { organization_id: organization.id, user_id: ownerId, role: "owner" },
      { onConflict: "organization_id,user_id" },
    );

  await supabase
    .from("memberships")
    .upsert(
      { organization_id: organization.id, user_id: demoUserId, role: "manager" },
      { onConflict: "organization_id,user_id" },
    );

  return organization;
}

async function reset(organizationId) {
  // Documents first: subjects are referenced by them.
  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("organization_id", organizationId);

  const paths = (documents ?? []).map((d) => d.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  await supabase.from("documents").delete().eq("organization_id", organizationId);
  await supabase.from("subjects").delete().eq("organization_id", organizationId);

  console.log(`• Cleared ${paths.length} existing demo document(s)`);
}

async function uploadFixture(organizationId, fixture) {
  const bytes = await readFile(path.join(HERE, "fixtures", fixture));
  const storagePath = `${organizationId}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf" });

  if (error) throw new Error(`Could not upload ${fixture}: ${error.message}`);
  return storagePath;
}

const SUBJECTS = [
  { kind: "vehicle", label: "Isuzu Elf NKR", identifier: "TXK 4417" },
  { kind: "vehicle", label: "Fuso Canter FE85", identifier: "NBM 2093" },
  { kind: "vehicle", label: "Hino 500 Series", identifier: "CAS 7761" },
  { kind: "person", label: "Ramon Delgado", identifier: "N02-19-884210" },
  { kind: "person", label: "Marisol Aquino", identifier: "N01-22-337195" },
];

/**
 * One document per dashboard band, so the demo shows the whole range rather
 * than a single tidy row. The review entry is what most visitors are here for.
 */
const DOCUMENTS = [
  {
    subject: "Fuso Canter FE85",
    type: "insurance_policy",
    title: "Fuso Canter FE85 — comprehensive insurance",
    issuer: "Pioneer Insurance",
    number: "PI-CV-884120",
    issuedDaysAgo: 377,
    expiresIn: -12, // already lapsed
    fixture: "sample-registration-clean.pdf",
  },
  {
    subject: "Isuzu Elf NKR",
    type: "vehicle_registration",
    title: "Isuzu Elf NKR — certificate of registration",
    issuer: "Metro Transport Registry Authority",
    number: "CR-2025-0047821",
    issuedDaysAgo: 361,
    expiresIn: 4, // urgent
    fixture: "sample-registration-clean.pdf",
  },
  {
    subject: "Ramon Delgado",
    type: "drivers_license",
    title: "Ramon Delgado — professional driver's licence",
    issuer: "Land Transport Authority",
    number: "N02-19-884210",
    issuedDaysAgo: 1076,
    expiresIn: 19,
    fixture: "sample-registration-clean.pdf",
  },
  {
    subject: "Hino 500 Series",
    type: "vehicle_registration",
    title: "Hino 500 Series — certificate of registration",
    issuer: "Metro Transport Registry Authority",
    number: "CR-2025-0051447",
    issuedDaysAgo: 321,
    expiresIn: 44,
    fixture: "sample-registration-clean.pdf",
  },
  {
    subject: "Marisol Aquino",
    type: "drivers_license",
    title: "Marisol Aquino — professional driver's licence",
    issuer: "Land Transport Authority",
    number: "N01-22-337195",
    issuedDaysAgo: 65,
    expiresIn: 300, // comfortably active
    fixture: "sample-registration-clean.pdf",
  },
];

/** The one waiting on a human. Mirrors the real result from the ambiguous scan. */
const REVIEW_DOCUMENT = {
  subject: "Isuzu Elf NKR",
  type: "insurance_policy",
  title: "Isuzu Elf NKR — insurance (scanned copy)",
  issuer: "Metro Transport Registry Authority",
  number: "CR-2O25-OO479l3",
  issuedDaysAgo: 371,
  expiresIn: 563,
  fixture: "sample-registration-ambiguous.pdf",
  confidence: 0.85,
};

async function main() {
  const admin = await findUserByEmail(adminEmail);
  if (!admin) {
    throw new Error(
      `No account for ${adminEmail}. Run \`pnpm seed:admin\` first — the demo organization needs an owner who is not the demo user.`,
    );
  }

  const demoUser = await ensureDemoUser();

  await supabase
    .from("profiles")
    .upsert(
      { id: demoUser.id, email, full_name: "Demo User" },
      { onConflict: "id" },
    );

  const organization = await ensureOrganization(admin.id, demoUser.id);
  await reset(organization.id);

  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .insert(
      SUBJECTS.map((s) => ({ ...s, organization_id: organization.id })),
    )
    .select();

  if (subjectError) {
    throw new Error(`Could not create subjects: ${subjectError.message}`);
  }

  const byLabel = new Map(subjects.map((s) => [s.label, s.id]));
  console.log(`✓ ${subjects.length} subjects`);

  for (const doc of DOCUMENTS) {
    const storagePath = await uploadFixture(organization.id, doc.fixture);
    const expiry = dateIn(doc.expiresIn);

    // Same rule the daily sweep applies, so the seeded rows are consistent
    // with what the system would have computed for itself.
    const status =
      doc.expiresIn < 0 ? "expired" : doc.expiresIn <= 60 ? "expiring" : "active";

    const { error } = await supabase.from("documents").insert({
      organization_id: organization.id,
      subject_id: byLabel.get(doc.subject) ?? null,
      type: doc.type,
      title: doc.title,
      storage_path: storagePath,
      status,
      document_number: doc.number,
      issuer: doc.issuer,
      issue_date: dateIn(-doc.issuedDaysAgo),
      expiry_date: expiry,
      uploaded_by: demoUser.id,
      responsible_user_id: demoUser.id,
    });

    if (error) throw new Error(`Could not insert ${doc.title}: ${error.message}`);
  }

  console.log(`✓ ${DOCUMENTS.length} tracked documents`);

  // The review entry, with the extraction attempt that produced it — without
  // the attempt row the review screen has no confidence to show and the queue
  // looks like arbitrary busywork.
  const reviewPath = await uploadFixture(organization.id, REVIEW_DOCUMENT.fixture);

  const { data: reviewDoc, error: reviewError } = await supabase
    .from("documents")
    .insert({
      organization_id: organization.id,
      subject_id: byLabel.get(REVIEW_DOCUMENT.subject) ?? null,
      type: REVIEW_DOCUMENT.type,
      title: REVIEW_DOCUMENT.title,
      storage_path: reviewPath,
      status: "needs_review",
      document_number: REVIEW_DOCUMENT.number,
      issuer: REVIEW_DOCUMENT.issuer,
      issue_date: dateIn(-REVIEW_DOCUMENT.issuedDaysAgo),
      expiry_date: dateIn(REVIEW_DOCUMENT.expiresIn),
      uploaded_by: demoUser.id,
      responsible_user_id: demoUser.id,
    })
    .select()
    .single();

  if (reviewError) {
    throw new Error(`Could not insert the review document: ${reviewError.message}`);
  }

  const { error: extractionError } = await supabase.from("extractions").insert({
    organization_id: organization.id,
    document_id: reviewDoc.id,
    provider: "gemini",
    model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    attempt: 1,
    status: "succeeded",
    confidence: REVIEW_DOCUMENT.confidence,
    extracted: {
      documentType: REVIEW_DOCUMENT.type,
      documentNumber: REVIEW_DOCUMENT.number,
      issuer: REVIEW_DOCUMENT.issuer,
      issueDate: dateIn(-REVIEW_DOCUMENT.issuedDaysAgo),
      expiryDate: dateIn(REVIEW_DOCUMENT.expiresIn),
      confidence: REVIEW_DOCUMENT.confidence,
    },
    raw_response: { seeded: true },
    error: null,
  });

  if (extractionError) {
    throw new Error(`Could not insert the extraction: ${extractionError.message}`);
  }

  console.log("✓ 1 document waiting in the review queue");

  const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log("");
  console.log("Demo ready.");
  console.log("  Sign in:  ", `${app}/login?email=${encodeURIComponent(email)}`);
  console.log("  Email:    ", email);
  console.log("  Password:  (the value of SEED_DEMO_PASSWORD)");
  console.log("  Role:      manager — cannot delete the organization");
  console.log("  Dashboard:", `${app}/${organization.slug}/dashboard`);
  console.log("");
  console.log("Re-run this any time to reset the demo data.");
}

main().catch((error) => {
  console.error("");
  console.error("Seed failed:", error.message);
  process.exit(1);
});
