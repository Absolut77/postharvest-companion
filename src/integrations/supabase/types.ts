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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bag_events: {
        Row: {
          actor: string
          at: string
          bag_id: string
          created_at: string
          delta_g: number
          event: string
          id: string
          note: string
        }
        Insert: {
          actor?: string
          at?: string
          bag_id: string
          created_at?: string
          delta_g?: number
          event: string
          id?: string
          note?: string
        }
        Update: {
          actor?: string
          at?: string
          bag_id?: string
          created_at?: string
          delta_g?: number
          event?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "bag_events_bag_id_fkey"
            columns: ["bag_id"]
            isOneToOne: false
            referencedRelation: "bags"
            referencedColumns: ["id"]
          },
        ]
      }
      bags: {
        Row: {
          actual_weight_g: number
          bag_number: number
          batch_id: string
          created_at: string
          id: string
          is_exception: boolean
          notes: string
          photo_urls: string[]
          qualification: Database["public"]["Enums"]["qualification"]
          stage: Database["public"]["Enums"]["bag_stage"]
          target_weight_g: number
          updated_at: string
        }
        Insert: {
          actual_weight_g?: number
          bag_number: number
          batch_id: string
          created_at?: string
          id?: string
          is_exception?: boolean
          notes?: string
          photo_urls?: string[]
          qualification: Database["public"]["Enums"]["qualification"]
          stage?: Database["public"]["Enums"]["bag_stage"]
          target_weight_g?: number
          updated_at?: string
        }
        Update: {
          actual_weight_g?: number
          bag_number?: number
          batch_id?: string
          created_at?: string
          id?: string
          is_exception?: boolean
          notes?: string
          photo_urls?: string[]
          qualification?: Database["public"]["Enums"]["qualification"]
          stage?: Database["public"]["Enums"]["bag_stage"]
          target_weight_g?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bags_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_stage_events: {
        Row: {
          actor: string
          at: string
          batch_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["batch_stage"] | null
          id: string
          note: string
          to_stage: Database["public"]["Enums"]["batch_stage"]
        }
        Insert: {
          actor?: string
          at?: string
          batch_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["batch_stage"] | null
          id?: string
          note?: string
          to_stage: Database["public"]["Enums"]["batch_stage"]
        }
        Update: {
          actor?: string
          at?: string
          batch_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["batch_stage"] | null
          id?: string
          note?: string
          to_stage?: Database["public"]["Enums"]["batch_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "batch_stage_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          batch_id: string
          created_at: string
          current_stage: Database["public"]["Enums"]["batch_stage"]
          dry_weight_g: number
          harvest_date: string | null
          id: string
          notes: string
          plant_count: number
          strain: string
          updated_at: string
          wet_weight_g: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["batch_stage"]
          dry_weight_g?: number
          harvest_date?: string | null
          id?: string
          notes?: string
          plant_count?: number
          strain?: string
          updated_at?: string
          wet_weight_g?: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["batch_stage"]
          dry_weight_g?: number
          harvest_date?: string | null
          id?: string
          notes?: string
          plant_count?: number
          strain?: string
          updated_at?: string
          wet_weight_g?: number
        }
        Relationships: []
      }
      bulk_packaging_runs: {
        Row: {
          batch_id: string
          created_at: string
          form_a_url: string
          form_b_url: string
          global_photo_urls: string[]
          id: string
          notes: string
          processing_loss_g: number
          retention_weight_g: number
          run_date: string
          sample_weight_g: number
          updated_at: string
          weight_out_curing_g: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          form_a_url?: string
          form_b_url?: string
          global_photo_urls?: string[]
          id?: string
          notes?: string
          processing_loss_g?: number
          retention_weight_g?: number
          run_date?: string
          sample_weight_g?: number
          updated_at?: string
          weight_out_curing_g?: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          form_a_url?: string
          form_b_url?: string
          global_photo_urls?: string[]
          id?: string
          notes?: string
          processing_loss_g?: number
          retention_weight_g?: number
          run_date?: string
          sample_weight_g?: number
          updated_at?: string
          weight_out_curing_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulk_packaging_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      curing_readings: {
        Row: {
          batch_id: string
          created_at: string
          humidity: number | null
          id: string
          note: string
          taken_at: string
          updated_at: string
          water_activity: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          humidity?: number | null
          id?: string
          note?: string
          taken_at?: string
          updated_at?: string
          water_activity?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          humidity?: number | null
          id?: string
          note?: string
          taken_at?: string
          updated_at?: string
          water_activity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curing_readings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      debudding_sessions: {
        Row: {
          batch_id: string
          created_at: string
          ease_rating: number | null
          ended_at: string | null
          id: string
          method: Database["public"]["Enums"]["debudding_method"]
          quality_notes: string
          started_at: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          ease_rating?: number | null
          ended_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["debudding_method"]
          quality_notes?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          ease_rating?: number | null
          ended_at?: string | null
          id?: string
          method?: Database["public"]["Enums"]["debudding_method"]
          quality_notes?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debudding_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      drying_readings: {
        Row: {
          batch_id: string
          created_at: string
          external_humidity: number | null
          id: string
          internal_humidity: number | null
          note: string
          room_temp_c: number | null
          sartorius_value: number | null
          taken_at: string
          updated_at: string
          water_activity: number | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          external_humidity?: number | null
          id?: string
          internal_humidity?: number | null
          note?: string
          room_temp_c?: number | null
          sartorius_value?: number | null
          taken_at?: string
          updated_at?: string
          water_activity?: number | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          external_humidity?: number | null
          id?: string
          internal_humidity?: number | null
          note?: string
          room_temp_c?: number | null
          sartorius_value?: number | null
          taken_at?: string
          updated_at?: string
          water_activity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drying_readings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          additional_comments: string
          adjustment_validation: boolean
          batch_id: string
          comment: string
          comment1: string
          comment2: string
          created_at: string
          destination: string
          detail: string
          direction: string
          elevated_update: boolean
          event_date: string
          from_import: boolean
          id: string
          initials: string
          product_format: string
          product_type: string
          quantity_g: number
          reason: string
          sku: string
          stamp_type: string
          stamp_used: string
          strain: string
          unit_indicator: string
          units: number
          units2: number
          updated_at: string
        }
        Insert: {
          additional_comments?: string
          adjustment_validation?: boolean
          batch_id: string
          comment?: string
          comment1?: string
          comment2?: string
          created_at?: string
          destination?: string
          detail?: string
          direction: string
          elevated_update?: boolean
          event_date?: string
          from_import?: boolean
          id?: string
          initials: string
          product_format?: string
          product_type?: string
          quantity_g?: number
          reason?: string
          sku?: string
          stamp_type?: string
          stamp_used?: string
          strain: string
          unit_indicator?: string
          units?: number
          units2?: number
          updated_at?: string
        }
        Update: {
          additional_comments?: string
          adjustment_validation?: boolean
          batch_id?: string
          comment?: string
          comment1?: string
          comment2?: string
          created_at?: string
          destination?: string
          detail?: string
          direction?: string
          elevated_update?: boolean
          event_date?: string
          from_import?: boolean
          id?: string
          initials?: string
          product_format?: string
          product_type?: string
          quantity_g?: number
          reason?: string
          sku?: string
          stamp_type?: string
          stamp_used?: string
          strain?: string
          unit_indicator?: string
          units?: number
          units2?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bag_stage:
        | "post_debudding"
        | "in_curing"
        | "bulk_packed"
        | "sampled"
        | "retained"
        | "shipped"
        | "destroyed"
      batch_stage:
        | "harvest"
        | "drying"
        | "debudding"
        | "sorting"
        | "curing"
        | "bulk_packaging"
        | "vault"
      debudding_method: "hand_trim" | "mobius"
      qualification: "handtrim" | "large" | "medium" | "small" | "trim"
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
      bag_stage: [
        "post_debudding",
        "in_curing",
        "bulk_packed",
        "sampled",
        "retained",
        "shipped",
        "destroyed",
      ],
      batch_stage: [
        "harvest",
        "drying",
        "debudding",
        "sorting",
        "curing",
        "bulk_packaging",
        "vault",
      ],
      debudding_method: ["hand_trim", "mobius"],
      qualification: ["handtrim", "large", "medium", "small", "trim"],
    },
  },
} as const
