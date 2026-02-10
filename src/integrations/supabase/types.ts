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
      dossiers: {
        Row: {
          address: string
          category: Database["public"]["Enums"]["problem_category"]
          client_email: string | null
          client_first_name: string
          client_last_name: string
          client_phone: string
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
          address: string
          category?: Database["public"]["Enums"]["problem_category"]
          client_email?: string | null
          client_first_name: string
          client_last_name: string
          client_phone: string
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
          address?: string
          category?: Database["public"]["Enums"]["problem_category"]
          client_email?: string | null
          client_first_name?: string
          client_last_name?: string
          client_phone?: string
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
      profiles: {
        Row: {
          auto_relance_enabled: boolean
          company_name: string | null
          created_at: string
          email: string | null
          email_signature: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          relance_delay_devis_1: number
          relance_delay_devis_2: number
          relance_delay_info: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_relance_enabled?: boolean
          company_name?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_info?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_relance_enabled?: boolean
          company_name?: string | null
          created_at?: string
          email?: string | null
          email_signature?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          relance_delay_devis_1?: number
          relance_delay_devis_2?: number
          relance_delay_info?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      urgency_level: ["aujourdhui", "48h", "semaine"],
    },
  },
} as const
