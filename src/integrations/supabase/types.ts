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
      costing_entries: {
        Row: {
          category: string | null
          cost_eur: number | null
          created_at: string
          created_by: string | null
          id: string
          item: string | null
          month: string
          notes: string | null
          price_eur: number | null
          project_id: string
          scope: string | null
        }
        Insert: {
          category?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item?: string | null
          month: string
          notes?: string | null
          price_eur?: number | null
          project_id: string
          scope?: string | null
        }
        Update: {
          category?: string | null
          cost_eur?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item?: string | null
          month?: string
          notes?: string | null
          price_eur?: number | null
          project_id?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costing_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      costing_tra: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: string
          notes: string | null
          panel_labour_cost_eur: number
          project_id: string
          selling_unit_price_eur: number
          tra_code: string
          unit_material_cost_eur: number
          unit_packaging_labour_cost_eur: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          notes?: string | null
          panel_labour_cost_eur?: number
          project_id: string
          selling_unit_price_eur?: number
          tra_code: string
          unit_material_cost_eur?: number
          unit_packaging_labour_cost_eur?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          notes?: string | null
          panel_labour_cost_eur?: number
          project_id?: string
          selling_unit_price_eur?: number
          tra_code?: string
          unit_material_cost_eur?: number
          unit_packaging_labour_cost_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          plan_date: string
          planned_qty: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          plan_date: string
          planned_qty?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          plan_date?: string
          planned_qty?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_production: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          produced_qty: number
          production_date: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          produced_qty?: number
          production_date: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          produced_qty?: number
          production_date?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          box_no: string | null
          comments: string | null
          created_at: string
          created_by: string | null
          delivery_date: string
          delivery_no: string | null
          id: string
          invoice_no: string | null
          mode: string | null
          project_id: string
          total_qty: number | null
          total_value_eur: number | null
          trainset: string | null
        }
        Insert: {
          box_no?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date: string
          delivery_no?: string | null
          id?: string
          invoice_no?: string | null
          mode?: string | null
          project_id: string
          total_qty?: number | null
          total_value_eur?: number | null
          trainset?: string | null
        }
        Update: {
          box_no?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          delivery_no?: string | null
          id?: string
          invoice_no?: string | null
          mode?: string | null
          project_id?: string
          total_qty?: number | null
          total_value_eur?: number | null
          trainset?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ecr_status: {
        Row: {
          cr_no: string
          cr_status: string | null
          created_at: string
          created_by: string | null
          date_initiation: string | null
          id: string
          offer_sent_alstom: string | null
          po_received_date: string | null
          project_id: string
          released_to_bids: string | null
          roa_remarks: string | null
          updated_at: string
        }
        Insert: {
          cr_no: string
          cr_status?: string | null
          created_at?: string
          created_by?: string | null
          date_initiation?: string | null
          id?: string
          offer_sent_alstom?: string | null
          po_received_date?: string | null
          project_id: string
          released_to_bids?: string | null
          roa_remarks?: string | null
          updated_at?: string
        }
        Update: {
          cr_no?: string
          cr_status?: string | null
          created_at?: string
          created_by?: string | null
          date_initiation?: string | null
          id?: string
          offer_sent_alstom?: string | null
          po_received_date?: string | null
          project_id?: string
          released_to_bids?: string | null
          roa_remarks?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_manufacturing: {
        Row: {
          actual_qty: number
          created_at: string
          created_by: string | null
          id: string
          month: string
          notes: string | null
          otd_percent: number | null
          planned_qty: number
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          notes?: string | null
          otd_percent?: number | null
          planned_qty?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          notes?: string | null
          otd_percent?: number | null
          planned_qty?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_plans: {
        Row: {
          created_at: string
          id: string
          month: string
          notes: string | null
          planned_qty: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          planned_qty?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          planned_qty?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      one_pager_financials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoiced_value_eur: number
          month: string
          notes: string | null
          project_id: string
          total_po_value_eur: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoiced_value_eur?: number
          month: string
          notes?: string | null
          project_id: string
          total_po_value_eur?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoiced_value_eur?: number
          month?: string
          notes?: string | null
          project_id?: string
          total_po_value_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      one_pager_updates: {
        Row: {
          action_plan: string | null
          challenges: string | null
          created_at: string
          created_by: string | null
          id: string
          ongoing_progress: string | null
          outstanding_balance_eur: number | null
          project_id: string
          quality_notes: string | null
          topic: string | null
          week_of: string
        }
        Insert: {
          action_plan?: string | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ongoing_progress?: string | null
          outstanding_balance_eur?: number | null
          project_id: string
          quality_notes?: string | null
          topic?: string | null
          week_of: string
        }
        Update: {
          action_plan?: string | null
          challenges?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          ongoing_progress?: string | null
          outstanding_balance_eur?: number | null
          project_id?: string
          quality_notes?: string | null
          topic?: string | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_pager_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      outstanding_balance_weekly: {
        Row: {
          amount_eur: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          week_of: string
        }
        Insert: {
          amount_eur?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          week_of: string
        }
        Update: {
          amount_eur?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          week_of?: string
        }
        Relationships: []
      }
      panels: {
        Row: {
          created_at: string
          customer_no: string | null
          description: string | null
          id: string
          line_no: number | null
          po_quantity: number | null
          price_bhd: number | null
          price_eur: number | null
          project_id: string
          qty_per_ts: number | null
          sales_order: string | null
          scope: string | null
          total_produced: number | null
          tra_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_no?: string | null
          description?: string | null
          id?: string
          line_no?: number | null
          po_quantity?: number | null
          price_bhd?: number | null
          price_eur?: number | null
          project_id: string
          qty_per_ts?: number | null
          sales_order?: string | null
          scope?: string | null
          total_produced?: number | null
          tra_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_no?: string | null
          description?: string | null
          id?: string
          line_no?: number | null
          po_quantity?: number | null
          price_bhd?: number | null
          price_eur?: number | null
          project_id?: string
          qty_per_ts?: number | null
          sales_order?: string | null
          scope?: string | null
          total_produced?: number | null
          tra_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "panels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          customer: string | null
          end_customer: string | null
          end_date: string | null
          id: string
          name: string
          oem: string | null
          po_cab: string | null
          po_fe: string | null
          scope: string | null
          site: string | null
          start_date: string | null
          trainsets: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_customer?: string | null
          end_date?: string | null
          id?: string
          name: string
          oem?: string | null
          po_cab?: string | null
          po_fe?: string | null
          scope?: string | null
          site?: string | null
          start_date?: string | null
          trainsets?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_customer?: string | null
          end_date?: string | null
          id?: string
          name?: string
          oem?: string | null
          po_cab?: string | null
          po_fe?: string | null
          scope?: string | null
          site?: string | null
          start_date?: string | null
          trainsets?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          channel: string | null
          id: string
          reminder_type: string
          sent_at: string
          triggered_for: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          id?: string
          reminder_type: string
          sent_at?: string
          triggered_for: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string
          triggered_for?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tracking_cells: {
        Row: {
          column_id: string
          id: string
          panel_id: string
          project_id: string
          updated_at: string
          value: number
        }
        Insert: {
          column_id: string
          id?: string
          panel_id: string
          project_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          column_id?: string
          id?: string
          panel_id?: string
          project_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracking_cells_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "tracking_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_columns: {
        Row: {
          column_date: string | null
          created_at: string
          created_by: string | null
          delivery_note: string | null
          id: string
          invoice_no: string | null
          label: string
          position: number
          project_id: string
        }
        Insert: {
          column_date?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note?: string | null
          id?: string
          invoice_no?: string | null
          label: string
          position?: number
          project_id: string
        }
        Update: {
          column_date?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note?: string | null
          id?: string
          invoice_no?: string | null
          label?: string
          position?: number
          project_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_daily_from_tracking: {
        Args: { _date: string; _project: string }
        Returns: undefined
      }
      recalc_monthly_manufacturing: {
        Args: { _month: string; _project: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
