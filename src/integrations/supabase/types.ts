export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string | null;
          id: string;
          is_required: boolean;
          max_quantity: number;
          min_quantity: number;
          name: string;
          status: string;
          store_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_required?: boolean;
          max_quantity?: number;
          min_quantity?: number;
          name: string;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_required?: boolean;
          max_quantity?: number;
          min_quantity?: number;
          name?: string;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "addon_groups_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      addons: {
        Row: {
          created_at: string | null;
          group_id: string;
          id: string;
          name: string;
          price: number;
          status: string;
          store_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          group_id: string;
          id?: string;
          name: string;
          price?: number;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          group_id?: string;
          id?: string;
          name?: string;
          price?: number;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "addons_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "addon_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addons_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          severity: string;
          starts_at: string;
          store_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          severity?: string;
          starts_at?: string;
          store_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          severity?: string;
          starts_at?: string;
          store_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          metadata: Json | null;
          module: string;
          store_id: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          module: string;
          store_id?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          module?: string;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string | null;
          id: string;
          image_url: string | null;
          name: string;
          sort_order: number;
          status: string;
          store_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          sort_order?: number;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          sort_order?: number;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_fees: {
        Row: {
          created_at: string | null;
          fee: number;
          id: string;
          neighborhood: string;
          status: string;
          store_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          fee?: number;
          id?: string;
          neighborhood: string;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          fee?: number;
          id?: string;
          neighborhood?: string;
          status?: string;
          store_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_fees_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      features: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_core: boolean;
          module: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          is_core?: boolean;
          module?: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_core?: boolean;
          module?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      fiscal_documents: {
        Row: {
          access_key: string | null;
          authorized_at: string | null;
          canceled_at: string | null;
          created_at: string;
          document_type: string;
          id: string;
          idempotency_key: string;
          number: number | null;
          order_id: string | null;
          pdf_path: string | null;
          provider: string | null;
          provider_document_id: string | null;
          rejection_reason: string | null;
          series: string | null;
          status: string;
          store_id: string;
          total_amount: number | null;
          updated_at: string;
          xml_path: string | null;
        };
        Insert: {
          access_key?: string | null;
          authorized_at?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          document_type?: string;
          id?: string;
          idempotency_key: string;
          number?: number | null;
          order_id?: string | null;
          pdf_path?: string | null;
          provider?: string | null;
          provider_document_id?: string | null;
          rejection_reason?: string | null;
          series?: string | null;
          status?: string;
          store_id: string;
          total_amount?: number | null;
          updated_at?: string;
          xml_path?: string | null;
        };
        Update: {
          access_key?: string | null;
          authorized_at?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          document_type?: string;
          id?: string;
          idempotency_key?: string;
          number?: number | null;
          order_id?: string | null;
          pdf_path?: string | null;
          provider?: string | null;
          provider_document_id?: string | null;
          rejection_reason?: string | null;
          series?: string | null;
          status?: string;
          store_id?: string;
          total_amount?: number | null;
          updated_at?: string;
          xml_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fiscal_documents_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      fiscal_events: {
        Row: {
          created_at: string;
          document_id: string;
          error_message: string | null;
          event_type: string;
          from_status: string | null;
          id: string;
          payload: Json | null;
          provider_event_id: string | null;
          store_id: string;
          to_status: string | null;
        };
        Insert: {
          created_at?: string;
          document_id: string;
          error_message?: string | null;
          event_type: string;
          from_status?: string | null;
          id?: string;
          payload?: Json | null;
          provider_event_id?: string | null;
          store_id: string;
          to_status?: string | null;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          error_message?: string | null;
          event_type?: string;
          from_status?: string | null;
          id?: string;
          payload?: Json | null;
          provider_event_id?: string | null;
          store_id?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fiscal_events_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "fiscal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fiscal_events_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      fiscal_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          document_id: string;
          id: string;
          idempotency_key: string;
          last_error: string | null;
          next_attempt_at: string;
          operation: string;
          status: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          document_id: string;
          id?: string;
          idempotency_key: string;
          last_error?: string | null;
          next_attempt_at?: string;
          operation: string;
          status?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          document_id?: string;
          id?: string;
          idempotency_key?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          operation?: string;
          status?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fiscal_outbox_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "fiscal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fiscal_outbox_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      fiscal_settings: {
        Row: {
          cnpj: string | null;
          created_at: string;
          document_type: string;
          environment: string;
          id: string;
          legal_name: string | null;
          provider: string | null;
          series: string;
          state_registration: string | null;
          store_id: string;
          tax_regime: string | null;
          trade_name: string | null;
          updated_at: string;
        };
        Insert: {
          cnpj?: string | null;
          created_at?: string;
          document_type?: string;
          environment?: string;
          id?: string;
          legal_name?: string | null;
          provider?: string | null;
          series?: string;
          state_registration?: string | null;
          store_id: string;
          tax_regime?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Update: {
          cnpj?: string | null;
          created_at?: string;
          document_type?: string;
          environment?: string;
          id?: string;
          legal_name?: string | null;
          provider?: string | null;
          series?: string;
          state_registration?: string | null;
          store_id?: string;
          tax_regime?: string | null;
          trade_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          observation: string | null;
          order_id: string | null;
          price_at_time: number;
          product_id: string | null;
          product_name: string | null;
          quantity: number;
          selected_addons: Json | null;
          store_id: string;
        };
        Insert: {
          id?: string;
          observation?: string | null;
          order_id?: string | null;
          price_at_time: number;
          product_id?: string | null;
          product_name?: string | null;
          quantity: number;
          selected_addons?: Json | null;
          store_id?: string;
        };
        Update: {
          id?: string;
          observation?: string | null;
          order_id?: string | null;
          price_at_time?: number;
          product_id?: string | null;
          product_name?: string | null;
          quantity?: number;
          selected_addons?: Json | null;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          from_status: string | null;
          id: string;
          order_id: string;
          store_id: string;
          to_status: string;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          order_id: string;
          store_id: string;
          to_status: string;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          from_status?: string | null;
          id?: string;
          order_id?: string;
          store_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_whatsapp_attempts: {
        Row: {
          created_at: string;
          error_message: string | null;
          event: string;
          id: string;
          message: string;
          order_id: string;
          phone: string;
          status: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event: string;
          id?: string;
          message: string;
          order_id: string;
          phone: string;
          status?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event?: string;
          id?: string;
          message?: string;
          order_id?: string;
          phone?: string;
          status?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_whatsapp_attempts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_whatsapp_attempts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string;
          cancel_reason: string | null;
          client_notified: boolean | null;
          complement: string | null;
          created_at: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_fee: number | null;
          id: string;
          neighborhood: string | null;
          number: string | null;
          observation: string | null;
          payment_method: string | null;
          change_for: number | null;
          reference: string | null;
          status: string;
          store_id: string;
          street: string | null;
          total_amount: number;
        };
        Insert: {
          address: string;
          cancel_reason?: string | null;
          client_notified?: boolean | null;
          complement?: string | null;
          created_at?: string | null;
          customer_name: string;
          customer_phone: string;
          delivery_fee?: number | null;
          id?: string;
          neighborhood?: string | null;
          number?: string | null;
          observation?: string | null;
          payment_method?: string | null;
          reference?: string | null;
          status?: string;
          store_id?: string;
          street?: string | null;
          total_amount: number;
          change_for?: number | null;
        };
        Update: {
          address?: string;
          cancel_reason?: string | null;
          client_notified?: boolean | null;
          complement?: string | null;
          created_at?: string | null;
          customer_name?: string;
          customer_phone?: string;
          delivery_fee?: number | null;
          id?: string;
          neighborhood?: string | null;
          number?: string | null;
          observation?: string | null;
          payment_method?: string | null;
          reference?: string | null;
          status?: string;
          store_id?: string;
          street?: string | null;
          total_amount?: number;
          change_for?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      billing_adjustments: {
        Row: {
          amount_cents: number;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_id: string;
          kind: string;
          reason: string;
          store_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id: string;
          kind: string;
          reason: string;
          store_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_id?: string;
          kind?: string;
          reason?: string;
          store_id?: string;
        };
        Relationships: [];
      };
      billing_customer_profiles: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          legal_name: string;
          phone: string | null;
          postal_code: string | null;
          provider: string;
          provider_customer_id: string | null;
          state: string | null;
          status: string;
          store_id: string;
          tax_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          legal_name: string;
          phone?: string | null;
          postal_code?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          state?: string | null;
          status?: string;
          store_id: string;
          tax_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          legal_name?: string;
          phone?: string | null;
          postal_code?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          state?: string;
          status?: string;
          store_id?: string;
          tax_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_invoices: {
        Row: {
          amount_cents: number;
          created_at: string;
          due_date: string;
          failure_reason: string | null;
          id: string;
          invoice_url: string | null;
          bank_slip_url: string | null;
          bank_slip_barcode: string | null;
          bank_slip_digitable_line: string | null;
          pix_qr_code: string | null;
          pix_copy_paste: string | null;
          metadata: Json;
          paid_at: string | null;
          payment_method: string | null;
          period_end: string;
          period_start: string;
          provider: string;
          provider_invoice_id: string | null;
          provider_payment_id: string | null;
          refunded_at: string | null;
          status: string;
          store_id: string;
          subscription_id: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          due_date: string;
          failure_reason?: string | null;
          id?: string;
          invoice_url?: string | null;
          bank_slip_url?: string | null;
          bank_slip_barcode?: string | null;
          bank_slip_digitable_line?: string | null;
          pix_qr_code?: string | null;
          pix_copy_paste?: string | null;
          metadata?: Json;
          paid_at?: string | null;
          payment_method?: string | null;
          period_end: string;
          period_start: string;
          provider?: string;
          provider_invoice_id?: string | null;
          provider_payment_id?: string | null;
          refunded_at?: string | null;
          status?: string;
          store_id: string;
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          due_date?: string;
          failure_reason?: string | null;
          id?: string;
          invoice_url?: string | null;
          bank_slip_url?: string | null;
          bank_slip_barcode?: string | null;
          bank_slip_digitable_line?: string | null;
          pix_qr_code?: string | null;
          pix_copy_paste?: string | null;
          metadata?: Json;
          paid_at?: string | null;
          payment_method?: string | null;
          period_end?: string;
          period_start?: string;
          provider?: string;
          provider_invoice_id?: string | null;
          provider_payment_id?: string | null;
          refunded_at?: string | null;
          status?: string;
          store_id?: string;
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_subscriptions: {
        Row: {
          amount_cents: number;
          billing_period: string;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          idempotency_key: string;
          metadata: Json;
          next_due_date: string | null;
          plan_id: string | null;
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          started_at: string | null;
          status: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          billing_period: string;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          next_due_date?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          started_at?: string | null;
          status?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          billing_period?: string;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          next_due_date?: string | null;
          plan_id?: string | null;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          started_at?: string | null;
          status?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
          provider: string;
          provider_event_id: string;
          signature_valid: boolean;
          status: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          provider?: string;
          provider_event_id: string;
          signature_valid?: boolean;
          status?: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          provider?: string;
          provider_event_id?: string;
          signature_valid?: boolean;
          status?: string;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          feature_id: string;
          plan_id: string;
        };
        Insert: {
          feature_id: string;
          plan_id: string;
        };
        Update: {
          feature_id?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey";
            columns: ["feature_id"];
            isOneToOne: false;
            referencedRelation: "features";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          billing_period: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          price_cents: number;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          billing_period?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          price_cents?: number;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          billing_period?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_cents?: number;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_addon_groups: {
        Row: {
          group_id: string;
          product_id: string;
          store_id: string;
        };
        Insert: {
          group_id: string;
          product_id: string;
          store_id?: string;
        };
        Update: {
          group_id?: string;
          product_id?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "addon_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_addon_groups_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string | null;
          category_id: string;
          created_at: string | null;
          description: string | null;
          featured_badge: string | null;
          featured_end_at: string | null;
          featured_sort_order: number;
          featured_start_at: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean | null;
          is_featured: boolean | null;
          is_on_sale: boolean;
          name: string;
          price: number;
          sale_end_at: string | null;
          sale_price: number | null;
          sale_start_at: string | null;
          store_id: string;
          updated_at: string | null;
        };
        Insert: {
          category?: string | null;
          category_id: string;
          created_at?: string | null;
          description?: string | null;
          featured_badge?: string | null;
          featured_end_at?: string | null;
          featured_sort_order?: number;
          featured_start_at?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          is_featured?: boolean | null;
          is_on_sale?: boolean;
          name: string;
          price: number;
          sale_end_at?: string | null;
          sale_price?: number | null;
          sale_start_at?: string | null;
          store_id?: string;
          updated_at?: string | null;
        };
        Update: {
          category?: string | null;
          category_id?: string;
          created_at?: string | null;
          description?: string | null;
          featured_badge?: string | null;
          featured_end_at?: string | null;
          featured_sort_order?: number;
          featured_start_at?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean | null;
          is_featured?: boolean | null;
          is_on_sale?: boolean;
          name?: string;
          price?: number;
          sale_end_at?: string | null;
          sale_price?: number | null;
          sale_start_at?: string | null;
          store_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          full_name: string | null;
          id: string;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          full_name?: string | null;
          id: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          full_name?: string | null;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      saas_settings: {
        Row: {
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          maintenance_message: string | null;
          maintenance_mode: boolean;
          name: string;
          primary_color: string;
          singleton: boolean;
          support_info: string | null;
          updated_at: string;
        };
        Insert: {
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          maintenance_message?: string | null;
          maintenance_mode?: boolean;
          name?: string;
          primary_color?: string;
          singleton?: boolean;
          support_info?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          maintenance_message?: string | null;
          maintenance_mode?: boolean;
          name?: string;
          primary_color?: string;
          singleton?: boolean;
          support_info?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_members: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_payment_gateways: {
        Row: {
          accept_card_delivery: boolean;
          accept_cash: boolean;
          accept_manual_pix: boolean;
          asaas_api_key: string | null;
          asaas_enabled: boolean;
          asaas_sandbox: boolean;
          card_provider: string;
          created_at: string;
          id: string;
          manual_pix_key: string | null;
          manual_pix_key_type: string | null;
          mp_access_token: string | null;
          mp_enabled: boolean;
          mp_public_key: string | null;
          mp_sandbox: boolean;
          pix_provider: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          accept_card_delivery?: boolean;
          accept_cash?: boolean;
          accept_manual_pix?: boolean;
          asaas_api_key?: string | null;
          asaas_enabled?: boolean;
          asaas_sandbox?: boolean;
          card_provider?: string;
          created_at?: string;
          id?: string;
          manual_pix_key?: string | null;
          manual_pix_key_type?: string | null;
          mp_access_token?: string | null;
          mp_enabled?: boolean;
          mp_public_key?: string | null;
          mp_sandbox?: boolean;
          pix_provider?: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          accept_card_delivery?: boolean;
          accept_cash?: boolean;
          accept_manual_pix?: boolean;
          asaas_api_key?: string | null;
          asaas_enabled?: boolean;
          asaas_sandbox?: boolean;
          card_provider?: string;
          created_at?: string;
          id?: string;
          manual_pix_key?: string | null;
          manual_pix_key_type?: string | null;
          mp_access_token?: string | null;
          mp_enabled?: boolean;
          mp_public_key?: string | null;
          mp_sandbox?: boolean;
          pix_provider?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_payment_gateways_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          address: string | null;
          auto_notify_whatsapp: boolean | null;
          cover_url: string | null;
          created_at: string | null;
          description: string | null;
          featured_section_title: string;
          id: string;
          instagram: string | null;
          is_open: boolean | null;
          logo_url: string | null;
          name: string;
          opening_hours: string | null;
          phone: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          store_id: string;
          updated_at: string | null;
          whatsapp: string | null;
          whatsapp_accept_enabled: boolean;
          whatsapp_cancel_enabled: boolean;
          whatsapp_shipping_enabled: boolean;
          whatsapp_template_aceito: string | null;
          whatsapp_template_cancelado: string | null;
          whatsapp_template_recebido: string | null;
          whatsapp_template_saida_entrega: string | null;
        };
        Insert: {
          address?: string | null;
          auto_notify_whatsapp?: boolean | null;
          cover_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          featured_section_title?: string;
          id?: string;
          instagram?: string | null;
          is_open?: boolean | null;
          logo_url?: string | null;
          name?: string;
          opening_hours?: string | null;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          store_id?: string;
          updated_at?: string | null;
          whatsapp?: string | null;
          whatsapp_accept_enabled?: boolean;
          whatsapp_cancel_enabled?: boolean;
          whatsapp_shipping_enabled?: boolean;
          whatsapp_template_aceito?: string | null;
          whatsapp_template_cancelado?: string | null;
          whatsapp_template_recebido?: string | null;
          whatsapp_template_saida_entrega?: string | null;
        };
        Update: {
          address?: string | null;
          auto_notify_whatsapp?: boolean | null;
          cover_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          featured_section_title?: string;
          id?: string;
          instagram?: string | null;
          is_open?: boolean | null;
          logo_url?: string | null;
          name?: string;
          opening_hours?: string | null;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          store_id?: string;
          updated_at?: string | null;
          whatsapp?: string | null;
          whatsapp_accept_enabled?: boolean;
          whatsapp_cancel_enabled?: boolean;
          whatsapp_shipping_enabled?: boolean;
          whatsapp_template_aceito?: string | null;
          whatsapp_template_cancelado?: string | null;
          whatsapp_template_recebido?: string | null;
          whatsapp_template_saida_entrega?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_id: string | null;
          plan_id: string | null;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_id?: string | null;
          plan_id?: string | null;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string | null;
          plan_id?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stores_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      user_permissions: {
        Row: {
          created_at: string | null;
          id: string;
          permission_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          permission_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          permission_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      append_audit_log: {
        Args: {
          _action: string;
          _description?: string;
          _metadata?: Json;
          _module: string;
          _store_id?: string;
        };
        Returns: undefined;
      };
      assign_store_owner: {
        Args: { _store_id: string; _user_id: string };
        Returns: undefined;
      };
      claim_order_whatsapp_attempt: {
        Args: {
          _event: string;
          _message: string;
          _order_id: string;
          _phone: string;
          _store_id: string;
        };
        Returns: {
          id: string;
          status: string;
        }[];
      };
      create_billing_subscription: {
        Args: {
          _amount_cents: number;
          _billing_period: string;
          _idempotency_key: string;
          _next_due_date: string;
          _plan_id: string;
          _starts_on: string;
          _store_id: string;
        };
        Returns: string;
      };
      record_billing_manual_event: {
        Args: {
          _invoice_id: string;
          _paid_at?: string;
          _reason: string;
          _status: string;
        };
        Returns: undefined;
      };
      record_billing_provider_payment: {
        Args: {
          _bank_slip_barcode?: string;
          _bank_slip_digitable_line?: string;
          _bank_slip_url?: string;
          _invoice_url?: string;
          _paid_at?: string;
          _payment_method?: string;
          _pix_copy_paste?: string;
          _pix_qr_code?: string;
          _provider_payment_id: string;
          _status: string;
        };
        Returns: string;
      };
      upsert_billing_customer_profile: {
        Args: {
          _address?: string;
          _city?: string;
          _email?: string;
          _legal_name: string;
          _phone?: string;
          _postal_code?: string;
          _state?: string;
          _store_id: string;
          _tax_id?: string;
        };
        Returns: string;
      };
      get_public_store_payment_methods: {
        Args: { _store_id: string };
        Returns: Json;
      };
      create_order: { Args: { _payload: Json }; Returns: Json };
      effective_price: {
        Args: { product: Database["public"]["Tables"]["products"]["Row"] };
        Returns: number;
      };
      get_public_catalog: { Args: { _store_id: string }; Returns: Json };
      get_public_delivery_fees: {
        Args: { _store_id: string };
        Returns: {
          fee: number;
          neighborhood: string;
        }[];
      };
      get_public_store: { Args: { _store_id: string }; Returns: Json };
      get_public_store_by_slug: { Args: { _slug: string }; Returns: Json };
      my_store_features: { Args: { _store_id: string }; Returns: string[] };
      super_admin_users: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          last_sign_in_at: string;
          role: Database["public"]["Enums"]["app_role"];
          status: string;
          stores: Json;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "user" | "employee" | "super_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "employee", "super_admin"],
    },
  },
} as const;
