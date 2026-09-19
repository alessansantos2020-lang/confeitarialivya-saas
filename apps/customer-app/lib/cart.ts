import { create } from "zustand";

export type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  image_url: string | null;
  quantity: number;
  observation: string;
  addon_ids: string[];
  addon_names: string[];
};

type CartState = {
  items: CartItem[];
  neighborhood: string | null;
  deliveryFee: number;
  addItem: (item: CartItem) => void;
  removeItem: (product_id: string) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  setDelivery: (fee: number, neighborhood: string) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  clearCart: () => void;
};

export const useCart = create<CartState>((set, get) => ({
  items: [],
  neighborhood: null,
  deliveryFee: 0,
  addItem: (item) =>
    set((state) => {
      const key = (i: CartItem) => `${i.product_id}:${i.addon_ids.slice().sort().join(",")}`;
      const existing = state.items.find((i) => key(i) === key(item));
      if (existing) {
        return {
          items: state.items.map((i) =>
            key(i) === key(item) ? { ...i, quantity: i.quantity + item.quantity } : i,
          ),
        };
      }
      return { items: [...state.items, item] };
    }),
  removeItem: (product_id) =>
    set((state) => ({ items: state.items.filter((i) => i.product_id !== product_id) })),
  updateQuantity: (product_id, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.product_id !== product_id)
          : state.items.map((i) => (i.product_id === product_id ? { ...i, quantity } : i)),
    })),
  setDelivery: (fee, neighborhood) => set({ deliveryFee: fee, neighborhood }),
  getSubtotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
  getTotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) + get().deliveryFee,
  clearCart: () => set({ items: [], deliveryFee: 0, neighborhood: null }),
}));
