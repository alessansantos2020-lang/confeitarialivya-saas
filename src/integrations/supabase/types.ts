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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean
          max_quantity: number
          min_quantity: number
          name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean
          max_quantity?: number
          min_quantity?: number
          name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean
          max_quantity?: number
          min_quantity?: number
          name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      addons: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          name: string
          price: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          name: string
          price?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          name?: string
          price?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          sort_order: number
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          created_at: string | null
          fee: number
          id: string
          neighborhood: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fee?: number
          id?: string
          neighborhood: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fee?: number
          id?: string
          neighborhood?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          observation: string | null
          order_id: string | null
          price_at_time: number
          product_id: string | null
          product_name: string | null
          quantity: number
          selected_addons: Json | null
        }
        Insert: {
          id?: string
          observation?: string | null
          order_id?: string | null
          price_at_time: number
          product_id?: string | null
          product_name?: string | null
          quantity: number
          selected_addons?: Json | null
        }
        Update: {
          id?: string
          observation?: string | null
          order_id?: string | null
          price_at_time?: number
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          selected_addons?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          client_notified: boolean | null
          complement: string | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number | null
          id: string
          neighborhood: string | null
          number: string | null
          observation: string | null
          payment_method: string | null
          reference: string | null
          status: string | null
          street: string | null
          total_amount: number
        }
        Insert: {
          address: string
          client_notified?: boolean | null
          complement?: string | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number | null
          id?: string
          neighborhood?: string | null
          number?: string | null
          observation?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string | null
          street?: string | null
          total_amount: number
        }
        Update: {
          address?: string
          client_notified?: boolean | null
          complement?: string | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number | null
          id?: string
          neighborhood?: string | null
          number?: string | null
          observation?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string | null
          street?: string | null
          total_amount?: number
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_addon_groups: {
        Row: {
          group_id: string
          product_id: string
        }
        Insert: {
          group_id: string
          product_id: string
        }
        Update: {
          group_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          address: string | null
          auto_notify_whatsapp: boolean | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string
          instagram: string | null
          is_open: boolean | null
          logo_url: string | null
          name: string
          opening_hours: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_template_recebido: string | null
          whatsapp_template_saida_entrega: string | null
        }
        Insert: {
          address?: string | null
          auto_notify_whatsapp?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_template_recebido?: string | null
          whatsapp_template_saida_entrega?: string | null
        }
        Update: {
          address?: string | null
          auto_notify_whatsapp?: boolean | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          instagram?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_template_recebido?: string | null
          whatsapp_template_saida_entrega?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "user" | "employee"
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
      app_role: ["admin", "user", "employee"],
    },
  },
} as const
