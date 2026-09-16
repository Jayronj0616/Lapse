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
    };
    Enums: {
      member_role: MemberRole;
      subject_kind: SubjectKind;
      document_type: DocumentType;
      document_status: DocumentStatus;
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
