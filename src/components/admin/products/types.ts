export type Category = {
  id: string;
  name: string;
};

export type AddonGroupOption = {
  id: string;
  name: string;
  is_required: boolean;
  min_quantity: number;
  max_quantity: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string;
  is_available: boolean;
  is_featured: boolean;
  is_on_sale: boolean;
  sale_price: number | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  created_at: string;
  category?: Category;
};
