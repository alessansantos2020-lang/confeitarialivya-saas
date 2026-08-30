import { createServerFn } from "@tanstack/react-start";

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

const MOCK_SETTINGS: StoreSettings = {
  name: "Confeitaria Livya",
  description: "Bolos, doces e sobremesas feitas com amor.",
  logo_url: null,
  cover_url: null,
  opening_hours: "Segunda a Sábado: 09:00 - 18:00",
  is_open: true,
  phone: "(11) 90000-0000",
  whatsapp: "5511900000000",
  instagram: "@confeitarialivya",
  address: "Rua das Flores, 123 - São Paulo",
  primary_color: "#db2777",
  secondary_color: "#fdf2f8",
  auto_notify_whatsapp: false,
  whatsapp_template_recebido: null,
  whatsapp_template_saida_entrega: null,
};

const MOCK_CATEGORIES = [
  {
    id: "cat-1",
    name: "Bolos",
    status: "active" as const,
    sort_order: 1,
    products: [
      {
        id: "prod-1",
        category_id: "cat-1",
        name: "Bolo de Chocolate",
        description: "Bolo de chocolate com cobertura cremosa e granulado.",
        price: 65.0,
        image_url: null,
        is_available: true,
        category: { name: "Bolos" },
      },
      {
        id: "prod-2",
        category_id: "cat-1",
        name: "Bolo de Cenoura",
        description: "Bolo fofinho de cenoura com cobertura de brigadeiro.",
        price: 55.0,
        image_url: null,
        is_available: true,
        category: { name: "Bolos" },
      },
    ],
  },
  {
    id: "cat-2",
    name: "Doces",
    status: "active" as const,
    sort_order: 2,
    products: [
      {
        id: "prod-3",
        category_id: "cat-2",
        name: "Brigadeiro Gourmet (6 un.)",
        description: "Brigadeiros artesanais em caixinha decorada.",
        price: 18.0,
        image_url: null,
        is_available: true,
        category: { name: "Doces" },
      },
      {
        id: "prod-4",
        category_id: "cat-2",
        name: "Beijinho (6 un.)",
        description: "Beijinhos de coco cobertos com açúcar cristal.",
        price: 18.0,
        image_url: null,
        is_available: true,
        category: { name: "Doces" },
      },
    ],
  },
  {
    id: "cat-3",
    name: "Sobremesas",
    status: "active" as const,
    sort_order: 3,
    products: [
      {
        id: "prod-5",
        category_id: "cat-3",
        name: "Pudim de Leite",
        description: "Pudim tradicional cremoso com calda de caramelo.",
        price: 32.0,
        image_url: null,
        is_available: true,
        category: { name: "Sobremesas" },
      },
    ],
  },
];

export const getStoreSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreSettings> => MOCK_SETTINGS,
);

export const getCategoriesWithProducts = createServerFn({ method: "GET" }).handler(
  async () => MOCK_CATEGORIES,
);
