import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type StoreSettings = {
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  opening_hours: string | null;
  is_open: boolean;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  auto_notify_whatsapp: boolean;
  whatsapp_template_recebido: string | null;
  whatsapp_template_saida_entrega: string | null;
};

export const getStoreSettings = createServerFn({ method: "GET" }).handler(async (): Promise<StoreSettings> => {
  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return {
      name: "Confeitaria Artesanal",
      description: "Bolos, doces e sobremesas feitas com amor.",
      logo_url: null,
      cover_url: null,
      opening_hours: "Segunda a Sábado: 09:00 - 18:00",
      is_open: true,
      phone: null,
      whatsapp: null,
      instagram: null,
      address: null,
      primary_color: "#db2777",
      secondary_color: "#fdf2f8",
      auto_notify_whatsapp: false,
      whatsapp_template_recebido: null,
      whatsapp_template_saida_entrega: null,
    };
  }

  return {
    name: data.name,
    description: data.description,
    logo_url: data.logo_url,
    cover_url: data.cover_url,
    opening_hours: data.opening_hours,
    is_open: data.is_open ?? true,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    address: data.address,
    primary_color: data.primary_color,
    secondary_color: data.secondary_color,
    auto_notify_whatsapp: data.auto_notify_whatsapp ?? false,
    whatsapp_template_recebido: (data as any).whatsapp_template_recebido,
    whatsapp_template_saida_entrega: (data as any).whatsapp_template_saida_entrega,
  };
});

export const getCategoriesWithProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (catError) throw catError;

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("*, category:categories(name)")
    .eq("is_available", true);

  if (prodError) throw prodError;

  return categories.map(category => ({
    ...category,
    products: products.filter(p => p.category_id === category.id)
  }));
});
