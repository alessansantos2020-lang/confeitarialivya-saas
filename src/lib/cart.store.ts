import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  observation?: string;
  addons: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface CartStore {
  items: CartItem[];
  deliveryFee: number;
  selectedNeighborhood: string | null;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  setDeliveryFee: (fee: number, neighborhood: string | null) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      deliveryFee: 0,
      selectedNeighborhood: null,
      addItem: (newItem) => {
        const items = get().items;
        const existingItemIndex = items.findIndex(
          (item) => 
            item.product_id === newItem.product_id && 
            JSON.stringify([...item.addons].sort((a,b) => a.id.localeCompare(b.id))) === 
            JSON.stringify([...newItem.addons].sort((a,b) => a.id.localeCompare(b.id))) &&
            (item.observation || "") === (newItem.observation || "")
        );

        if (existingItemIndex > -1) {
          const newItems = [...items];
          const existingItem = newItems[existingItemIndex];
          if (existingItem) {
            existingItem.quantity += newItem.quantity;
            set({ items: newItems });
          }
        } else {
          set({ items: [...items, { ...newItem, id: crypto.randomUUID() }] });
        }
      },
      removeItem: (itemId) => {
        set({ items: get().items.filter((item) => item.id !== itemId) });
      },
      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }
        set({
          items: get().items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          ),
        });
      },
      setDeliveryFee: (fee, neighborhood) => {
        set({ deliveryFee: fee, selectedNeighborhood: neighborhood });
      },
      clearCart: () => set({ items: [], deliveryFee: 0, selectedNeighborhood: null }),
      getTotalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
      getSubtotal: () =>
        get().items.reduce((acc, item) => {
          const addonsTotal = item.addons.reduce((sum, addon) => sum + addon.price, 0);
          return acc + (item.price + addonsTotal) * item.quantity;
        }, 0),
      getDeliveryFee: () => get().deliveryFee,
      getTotal: () => get().getSubtotal() + get().getDeliveryFee(),
    }),
    {
      name: 'cart-storage',
    }
  )
);
