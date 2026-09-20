import { create } from "zustand";

export type CartAddon = { id: string; name: string; price: number };

export type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  image_url: string | null;
  quantity: number;
  observation: string;
  addon_ids: string[];
  addons: CartAddon[];
};

export function lineKey(item: Pick<CartItem, "product_id" | "addon_ids" | "observation">): string {
  return `${item.product_id}:${item.addon_ids.slice().sort().join(",")}:${item.observation.trim()}`;
}

export function itemUnitPrice(item: CartItem): number {
  return item.unit_price + item.addons.reduce((sum, a) => sum + a.price, 0);
}

type CartState = {
  items: CartItem[];
  neighborhood: string | null;
  deliveryFee: number;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  setDelivery: (fee: number, neighborhood: string) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getTotalItems: () => number;
  clearCart: () => void;
};

export const useCart = create<CartState>((set, get) => ({
  items: [],
  neighborhood: null,
  deliveryFee: 0,
  addItem: (item) =>
    set((state) => {
      const key = lineKey(item);
      const existing = state.items.find((i) => lineKey(i) === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            lineKey(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i,
          ),
        };
      }
      return { items: [...state.items, item] };
    }),
  removeItem: (key) => set((state) => ({ items: state.items.filter((i) => lineKey(i) !== key) })),
  updateQuantity: (key, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => lineKey(i) !== key)
          : state.items.map((i) => (lineKey(i) === key ? { ...i, quantity } : i)),
    })),
  setDelivery: (fee, neighborhood) => set({ deliveryFee: fee, neighborhood }),
  getSubtotal: () => get().items.reduce((sum, i) => sum + itemUnitPrice(i) * i.quantity, 0),
  getTotal: () => get().getSubtotal() + get().deliveryFee,
  getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  clearCart: () => set({ items: [], deliveryFee: 0, neighborhood: null }),
}));
