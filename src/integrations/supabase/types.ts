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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      api_logs: {
        Row: {
          calculated_cost: number | null
          completion_tokens: number | null
          created_at: string
          id: number
          model_name: string | null
          organization_id: string | null
          prompt_tokens: number | null
          request_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          calculated_cost?: number | null
          completion_tokens?: number | null
          created_at?: string
          id?: number
          model_name?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          calculated_cost?: number | null
          completion_tokens?: number | null
          created_at?: string
          id?: number
          model_name?: string | null
          organization_id?: string | null
          prompt_tokens?: number | null
          request_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      diagnosis_results: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          is_final: boolean | null
          organization_id: string | null
          request_id: string
          step_name: string
          user_id: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          organization_id?: string | null
          request_id: string
          step_name: string
          user_id?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          is_final?: boolean | null
          organization_id?: string | null
          request_id?: string
          step_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          install_date: string | null
          last_inspection_date: string | null
          location: string
          location_id: string | null
          manufacturer: string | null
          name: string
          next_inspection_date: string | null
          organization_id: string | null
          specifications: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          install_date?: string | null
          last_inspection_date?: string | null
          location: string
          location_id?: string | null
          manufacturer?: string | null
          name: string
          next_inspection_date?: string | null
          organization_id?: string | null
          specifications: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          install_date?: string | null
          last_inspection_date?: string | null
          location?: string
          location_id?: string | null
          manufacturer?: string | null
          name?: string
          next_inspection_date?: string | null
          organization_id?: string | null
          specifications?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inspection_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      field_photos: {
        Row: {
          caption: string | null
          created_by: string | null
          equipment_id: string | null
          id: string
          inspection_id: string | null
          memo: string | null
          organization_id: string | null
          photo_url: string
          updated_by: string | null
          uploaded_at: string | null
        }
        Insert: {
          caption?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          inspection_id?: string | null
          memo?: string | null
          organization_id?: string | null
          photo_url: string
          updated_by?: string | null
          uploaded_at?: string | null
        }
        Update: {
          caption?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          inspection_id?: string | null
          memo?: string | null
          organization_id?: string | null
          photo_url?: string
          updated_by?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_photos_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "performance_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_locations: {
        Row: {
          address: string
          assigned_inspector_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          equipment_count: number | null
          id: string
          name: string
          organization_id: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address: string
          assigned_inspector_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_count?: number | null
          id?: string
          name: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string
          assigned_inspector_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          equipment_count?: number | null
          id?: string
          name?: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_locations_assigned_inspector_id_fkey"
            columns: ["assigned_inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          equipment_type: string
          id: string
          is_active: boolean | null
          items: Json
          organization_id: string | null
          template_name: string
          updated_at: string | null
          updated_by: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          equipment_type: string
          id?: string
          is_active?: boolean | null
          items?: Json
          organization_id?: string | null
          template_name: string
          updated_at?: string | null
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          equipment_type?: string
          id?: string
          is_active?: boolean | null
          items?: Json
          organization_id?: string | null
          template_name?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          inspector_id: string
          organization_id: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          inspector_id: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          inspector_id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspector_contacts_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspector_contacts_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectors: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_team_leader: boolean | null
          location_id: string | null
          name: string
          organization_id: string | null
          position: string | null
          technical_grade: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_team_leader?: boolean | null
          location_id?: string | null
          name: string
          organization_id?: string | null
          position?: string | null
          technical_grade?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_team_leader?: boolean | null
          location_id?: string | null
          name?: string
          organization_id?: string | null
          position?: string | null
          technical_grade?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inspection_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          equipment_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          equipment_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          equipment_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: []
      }
      measurement_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          inspection_id: string | null
          item_name: string
          measured_value: number | null
          notes: string | null
          organization_id: string | null
          result: string | null
          standard_value: string | null
          unit: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          inspection_id?: string | null
          item_name: string
          measured_value?: number | null
          notes?: string | null
          organization_id?: string | null
          result?: string | null
          standard_value?: string | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          inspection_id?: string | null
          item_name?: string
          measured_value?: number | null
          notes?: string | null
          organization_id?: string | null
          result?: string | null
          standard_value?: string | null
          unit?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "performance_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_api_billings: {
        Row: {
          billing_month: string
          created_at: string
          id: number
          organization_id: string
          total_cost_usd: number
          total_requests: number
          total_tokens_used: number
          user_id: string
        }
        Insert: {
          billing_month: string
          created_at?: string
          id?: number
          organization_id: string
          total_cost_usd?: number
          total_requests?: number
          total_tokens_used?: number
          user_id: string
        }
        Update: {
          billing_month?: string
          created_at?: string
          id?: number
          organization_id?: string
          total_cost_usd?: number
          total_requests?: number
          total_tokens_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_api_billings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_inspections: {
        Row: {
          created_at: string | null
          created_by: string | null
          equipment_id: string | null
          id: string
          inspection_date: string | null
          inspector_id: string | null
          location_id: string | null
          notes: string | null
          organization_id: string | null
          overall_result: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          overall_result?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          equipment_id?: string | null
          id?: string
          inspection_date?: string | null
          inspector_id?: string | null
          location_id?: string | null
          notes?: string | null
          organization_id?: string | null
          overall_result?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_inspections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "inspectors_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_inspections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inspection_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_inspections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_inspector_access: {
        Row: {
          created_at: string
          id: string
          inspector_id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspector_id: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inspector_id?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      inspectors_public: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string | null
          is_team_leader: boolean | null
          location_id: string | null
          name: string | null
          organization_id: string | null
          position: string | null
          technical_grade: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_team_leader?: boolean | null
          location_id?: string | null
          name?: string | null
          organization_id?: string | null
          position?: string | null
          technical_grade?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_team_leader?: boolean | null
          location_id?: string | null
          name?: string | null
          organization_id?: string | null
          position?: string | null
          technical_grade?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspectors_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inspection_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspectors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_and_and_store_monthly_api_billings: {
        Args: { billing_ref_date: string; company_name?: string }
        Returns: undefined
      }
      calculate_and_store_monthly_api_billings: {
        Args: { billing_ref_date: string; company_name?: string }
        Returns: undefined
      }
      execute_sql: {
        Args: { sql: string }
        Returns: {
          result_json: Json
        }[]
      }
      get_company_billing: {
        Args: Record<PropertyKey, never>
        Returns: {
          name: string
          total_cost_usd: number
          total_requests: number
          total_tokens_used: number
        }[]
      }
      get_current_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_api_summary_for_billing_cycle: {
        Args: { billing_reference_date: string; company_name?: string }
        Returns: {
          total_cost_usd: number
          total_requests: number
          total_tokens_used: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_user_billing: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          name: string
          total_cost_usd: number
          total_requests: number
          total_tokens_used: number
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      match_documents: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
