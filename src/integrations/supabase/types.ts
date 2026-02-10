export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      catalog_material: {
        Row: {
          category_path: string
          created_at: string
          default_qty: number | null
          id: string
          label: string
          tags: string[] | null
          type: string
          unit: string | null
          unit_price: number | null
          user_id: string | null
          vat_rate: number | null
        }
        Insert: {
          category_path: string
          created_at?: string
          default_qty?: number | null
          id?: string
          label: string
          tags?: string[] | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          user_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          category_path?: string
          created_at?: string
          default_qty?: number | null
          id?: string
          label?: string
          tags?: string[] | null
          type?: string
          unit?: string | null
          unit_price?: number | null
          user_id?: string | null
          vat_rate?: number | null
        }
        Relationships: []
      }
      dossiers: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["problem_category"]
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          client_token: string | null
          client_token_expires_at: string | null
          created_at: string
          description: string | null
          id: string
          last_relance_at: string | null
          relance_active: boolean
          relance_count: number
          source: Database["public"]["Enums"]["dossier_source"]
          status: Database["public"]["Enums"]["dossier_status"]
          status_changed_at: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["problem_category"]
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_relance_at?: string | null
          relance_active?: boolean
          relance_count?: number
          source?: Database["public"]["Enums"]["dossier_source"]
          status?: Database["public"]["Enums"]["dossier_status"]
          status_changed_at?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["problem_category"]
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          client_token_expires_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_relance_at?: string | null
          relance_active?: boolean
          relance_count?: number
          source?: Database["public"]["Enums"]["dossier_source"]
          status?: Database["public"]["Enums"]["dossier_status"]
          status_changed_at?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id?: string
        }
        Relationships: []
      }
      historique: {
        Row: {
          action: string
          created_at: string
          details: string | null
          dossier_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          dossier_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          dossier_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historique_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_templates: {
        Row: {
          context_tags: string[] | null
          created_at: string
          duration_default_min: number | null
          id: string
          text_reassuring: string
          text_short: string
          text_standard: string
        }
        Insert: {
          context_tags?: string[] | null
          created_at?: string
          duration_default_min?: number | null
          id?: string
          text_reassuring: string
          text_short: string
          text_standard: string
        }
        Update: {
          context_tags?: string[] | null
          created_at?: string
          duration_default_min?: number | null
          id?: string
          text_reassuring?: string
          text_short?: string
          text_standard?: string
        }
        Relationships: []
      }
      material_correspondence: {
        Row: {
          conditions_json: Json | null
          created_at: string
          default_qty: number | null
          group_label: string | null
          id: string
          source_material_id: string
          target_material_id: string
          weight: number | null
        }
        Insert: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          group_label?: string | null
          id?: string
          source_material_id: string
          target_material_id: string
          weight?: number | null
        }
        Update: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          group_label?: string | null
          id?: string
          source_material_id?: string
          target_material_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_correspondence_source_material_id_fkey"
            columns: ["source_material_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_correspondence_target_material_id_fkey"
            columns: ["target_material_id"]
            isOneToOne: false
            referencedRelation: "catalog_material"
            referencedColumns: ["id"]
          },
        ]
      }
      medias: {
        Row: {
          created_at: string
          dossier_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medias_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_taxonomy: {
        Row: {
          created_at: string
          default_context: Json | null
          id: string
          keywords: string[] | null
          label: string
          parent_id: string | null
          sort_order: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_context?: Json | null
          id?: string
          keywords?: string[] | null
          label: string
          parent_id?: string | null
          sort_order?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_context?: Json | null
          id?: string
          keywords?: string[] | null
          label?: string
          parent_id?: string | null
          sort_order?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_taxonomy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "problem_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_to_manoeuvre: {
        Row: {
          conditions_json: Json | null
          created_at: string
          default_qty: number | null
          description: string | null
          id: string
          label: string
          problem_id: string
          type: string | null
          unit: string | null
          unit_price: number | null
          vat_rate: number | null
          weight: number | null
        }
        Insert: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          description?: string | null
          id?: string
          label: string
          problem_id: string
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
          weight?: number | null
        }
        Update: {
          conditions_json?: Json | null
          created_at?: string
          default_qty?: number | null
          description?: string | null
          id?: string
          label?: string
          problem_id?: string
          type?: string | null
          unit?: string | null
          unit_price?: number | null
          vat_rate?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_to_manoeuvre_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problem_taxonomy"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          auto_relance_enabled: boolean
          company_name: string | null
          created_at: string
          default_validity_days: number | null
          default_vat_rate: number | null
          email: string | null
          email_signature: string | null
          first_name: string | null
          id: string
          last_name: string | null
          logo_url: string | null
          phone: string | null
          relance_delay_devis_1: number
          relance_delay_devis_2: number
          relance_delay_info: number
          siret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          auto_relance_enabled?: boolean
          company_name?: string | null
          created_at?: string
          default_validity_days?: number | null
          default_vat_rate?: number | null
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          logo_url?: string | null
          phone?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_info?: number
          siret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          auto_relance_enabled?: boolean
          company_name?: string | null
          created_at?: string
          default_validity_days?: number | null
          default_vat_rate?: number | null
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          logo_url?: string | null
          phone?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_info?: number
          siret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          dossier_id: string
          id: string
          is_imported: boolean
          items: Json | null
          notes: string | null
          pdf_url: string | null
          quote_number: string
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          total_ht: number | null
          total_ttc: number | null
          total_tva: number | null
          updated_at: string
          user_id: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          dossier_id: string
          id?: string
          is_imported?: boolean
          items?: Json | null
          notes?: string | null
          pdf_url?: string | null
          quote_number: string
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          dossier_id?: string
          id?: string
          is_imported?: boolean
          items?: Json | null
          notes?: string | null
          pdf_url?: string | null
          quote_number?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          total_ttc?: number | null
          total_tva?: number | null
          updated_at?: string
          user_id?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      relances: {
        Row: {
          dossier_id: string
          email_to: string
          id: string
          sent_at: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          dossier_id: string
          email_to: string
          id?: string
          sent_at?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          dossier_id?: string
          email_to?: string
          id?: string
          sent_at?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relances_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "artisan"
      dossier_source: "lien_client" | "manuel" | "email"
      dossier_status:
        | "nouveau"
        | "a_qualifier"
        | "devis_a_faire"
        | "devis_envoye"
        | "clos_signe"
        | "clos_perdu"
      problem_category:
        | "wc"
        | "fuite"
        | "chauffe_eau"
        | "evier"
        | "douche"
        | "autre"
      quote_status: "brouillon" | "envoye" | "signe" | "refuse"
      urgency_level: "aujourdhui" | "48h" | "semaine"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "artisan"],
      dossier_source: ["lien_client", "manuel", "email"],
      dossier_status: [
        "nouveau",
        "a_qualifier",
        "devis_a_faire",
        "devis_envoye",
        "clos_signe",
        "clos_perdu",
      ],
      problem_category: [
        "wc",
        "fuite",
        "chauffe_eau",
        "evier",
        "douche",
        "autre",
      ],
      quote_status: ["brouillon", "envoye", "signe", "refuse"],
      urgency_level: ["aujourdhui", "48h", "semaine"],
    },
  },
} as const
