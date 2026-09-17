/**
 * Database types.
 *
 * HAND-MAINTAINED. `supabase gen types typescript --linked` fails on this
 * project with a management-API privilege error, so this file mirrors
 * `supabase/migrations/` by hand.
 *
 * Keep it in step with every migration. A drifting type here is worse than no
 * type, because it lies confidently — TypeScript will happily green-light a
 * column that does not exist.
 *
 * Replace the whole file with generated output the moment that command works:
 *   pnpm supabase gen types typescript --linked > lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MemberRole = "owner" | "manager" | "staff";

export type SubjectKind = "vehicle" | "person";

export type DocumentType =
  | "vehicle_registration"
  | "insurance_policy"
  | "drivers_license";

export type DocumentStatus =
  | "processing"
  | "needs_review"
  | "active"
  | "expiring"
  | "expired"
  | "extraction_failed"
  | "archived";

export type ExtractionStatus = "pending" | "succeeded" | "failed";

export type ReviewAction = "approved" | "corrected" | "rejected";

export type ReminderTier = "t60" | "t30" | "t7" | "t1" | "overdue";

export type ReminderChannel = "email" | "in_app";

export type JobStatus = "running" | "succeeded" | "failed";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; created_at?: string };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          organization_id: string;
          kind: SubjectKind;
          label: string;
          identifier: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: SubjectKind;
          label: string;
          identifier?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          kind?: SubjectKind;
          label?: string;
          identifier?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          subject_id: string | null;
          type: DocumentType;
          title: string;
          storage_path: string;
          status: DocumentStatus;
          document_number: string | null;
          issuer: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          uploaded_by: string | null;
          responsible_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          subject_id?: string | null;
          type: DocumentType;
          title: string;
          storage_path: string;
          status?: DocumentStatus;
          document_number?: string | null;
          issuer?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          uploaded_by?: string | null;
          responsible_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          subject_id?: string | null;
          type?: DocumentType;
          title?: string;
          storage_path?: string;
          status?: DocumentStatus;
          document_number?: string | null;
          issuer?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          uploaded_by?: string | null;
          responsible_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        // Written only by the record_audit trigger. No application code
        // inserts here, which is the point — see migration 0002.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      extractions: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          provider: string;
          model: string;
          attempt: number;
          status: ExtractionStatus;
          confidence: number | null;
          extracted: Json | null;
          raw_response: Json | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          provider: string;
          model: string;
          attempt?: number;
          status?: ExtractionStatus;
          confidence?: number | null;
          extracted?: Json | null;
          raw_response?: Json | null;
          error?: string | null;
          created_at?: string;
        };
        // No client write policy — written by the job with the secret key.
        Update: never;
        Relationships: [];
      };
      document_reviews: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          reviewer_id: string | null;
          action: ReviewAction;
          before: Json | null;
          after: Json | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          reviewer_id: string;
          action: ReviewAction;
          before?: Json | null;
          after?: Json | null;
          note?: string | null;
          created_at?: string;
        };
        // Reviews are never edited. A correctable audit record is not one.
        Update: never;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string;
          tier: ReminderTier;
          channel: ReminderChannel;
          scheduled_for: string;
          sent_at: string | null;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          escalated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id: string;
          tier: ReminderTier;
          channel: ReminderChannel;
          scheduled_for: string;
          sent_at?: string | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          escalated_at?: string | null;
          created_at?: string;
        };
        /**
         * Only what the sweep writes. `acknowledged_at` and `acknowledged_by`
         * are deliberately absent: those are set by the
         * `acknowledge_reminder()` function, which is the only thing allowed
         * to record that a person saw this. Widening this type would make it
         * possible to fake an acknowledgement from application code.
         */
        Update: {
          sent_at?: string | null;
          escalated_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          // Not nullable since 0006: a notification whose reminder is gone has
          // nothing to say, so it is cascade-deleted rather than orphaned.
          reminder_id: string;
          title: string;
          body: string | null;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          reminder_id: string;
          title: string;
          body?: string | null;
          href?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: { read_at?: string | null };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: MemberRole;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: MemberRole;
          token?: string;
          invited_by: string;
          expires_at?: string;
        };
        // An invitation's email and role are fixed once the link is sent.
        // Revoking is a delete; accepting goes through accept_invitation().
        Update: never;
        Relationships: [];
      };
      job_runs: {
        Row: {
          id: string;
          job_name: string;
          status: JobStatus;
          started_at: string;
          finished_at: string | null;
          items_processed: number;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_name: string;
          status?: JobStatus;
          started_at?: string;
          finished_at?: string | null;
          items_processed?: number;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          status?: JobStatus;
          finished_at?: string | null;
          items_processed?: number;
          error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_member_of: { Args: { org: string }; Returns: boolean };
      role_in: { Args: { org: string }; Returns: MemberRole };
      shares_org_with: { Args: { other_user: string }; Returns: boolean };
      create_organization: {
        Args: { org_name: string; org_slug: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      can_edit_document: { Args: { doc: string }; Returns: boolean };
      acknowledge_reminder: { Args: { reminder: string }; Returns: undefined };
      invitation_preview: {
        Args: { invite_token: string };
        Returns: { organization_name: string; email: string; valid: boolean }[];
      };
      accept_invitation: { Args: { invite_token: string }; Returns: string };
    };
    Enums: {
      member_role: MemberRole;
      subject_kind: SubjectKind;
      document_type: DocumentType;
      document_status: DocumentStatus;
      extraction_status: ExtractionStatus;
      review_action: ReviewAction;
      reminder_tier: ReminderTier;
      reminder_channel: ReminderChannel;
      job_status: JobStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type Organization = Tables<"organizations">;
export type Profile = Tables<"profiles">;
export type Membership = Tables<"memberships">;
export type Subject = Tables<"subjects">;
export type DocumentRow = Tables<"documents">;
export type AuditEntry = Tables<"audit_log">;
export type Extraction = Tables<"extractions">;
export type DocumentReview = Tables<"document_reviews">;
export type Reminder = Tables<"reminders">;
export type Notification = Tables<"notifications">;
export type JobRun = Tables<"job_runs">;
export type Invitation = Tables<"invitations">;
