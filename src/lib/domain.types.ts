import type { Enums, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { OrderStatus } from "./order-status";
import type { SelectedAddonPreview } from "./order-utils";

export type AppRole = Enums<"app_role">;
export type StoreStatus = "active" | "inactive" | "suspended";
export type StoreRow = Tables<"stores">;
export type StoreInsert = TablesInsert<"stores">;
export type StoreUpdate = TablesUpdate<"stores">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type ProductRow = Tables<"products">;
export type StoreSettingsRow = Tables<"store_settings">;

export type CustomerSummary = {
  name: string;
  phone: string;
  address: string | null;
  total_orders: number;
  last_order_date: string | null;
  last_order_id: string | null;
};

export type OrderStatusValue = OrderStatus;
export type SelectedAddon = SelectedAddonPreview;
