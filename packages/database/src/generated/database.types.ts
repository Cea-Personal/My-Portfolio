export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  app: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          headline: string | null;
          bio: string | null;
          location: string | null;
          timezone: string;
          locale: string;
          revision: number;
        };
        Insert: Omit<Database["app"]["Tables"]["profiles"]["Row"], "revision"> & {
          revision?: number;
        };
        Update: Partial<Database["app"]["Tables"]["profiles"]["Insert"]>;
      };
      audit_events: {
        Row: {
          id: string;
          owner_id: string;
          action: string;
          target_type: string;
          correlation_id: string;
          occurred_at: string;
        };
        Insert: Omit<Database["app"]["Tables"]["audit_events"]["Row"], "id" | "occurred_at">;
        Update: never;
      };
    };
  };
  published: {
    Tables: {
      portfolio_publications: {
        Row: {
          id: string;
          owner_id: string;
          version: number;
          status: "staged" | "published" | "withdrawn";
          content_hash: string;
        };
        Insert: Omit<Database["published"]["Tables"]["portfolio_publications"]["Row"], "id">;
        Update: never;
      };
      portfolio_items: {
        Row: {
          id: string;
          publication_id: string;
          public_id: string;
          title: string;
          public_summary: string;
        };
        Insert: Omit<Database["published"]["Tables"]["portfolio_items"]["Row"], "id">;
        Update: never;
      };
    };
  };
  api: {
    Views: {
      current_publication: {
        Row: {
          id: string;
          owner_id: string;
          version: number;
          content_hash: string;
          schema_version: string;
          published_at: string | null;
        };
      };
      public_portfolio_items: { Row: Database["published"]["Tables"]["portfolio_items"]["Row"] };
    };
  };
}
