import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cartItemIdentityKey } from "./order-utils";

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

interface CartData {
  items: CartItem[];
  deliveryFee: number;
  selectedNeighborhood: string | null;
}

interface CartStore extends CartData {
  storeId: string | null;
  cartsByStore: Record<string, CartData>;
  setStoreContext: (storeId: string) => void;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  setDeliveryFee: (fee: number, neighborhood: string | null) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
}

const emptyCart = (): CartData => ({
  items: [],
  deliveryFee: 0,
  selectedNeighborhood: null,
});

const cartData = (state: CartStore): CartData => ({
  items: state.items,
  deliveryFee: state.deliveryFee,
  selectedNeighborhood: state.selectedNeighborhood,
});

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      ...emptyCart(),
      storeId: null,
      cartsByStore: {},
      setStoreContext: (storeId) => {
        const state = get();
        if (state.storeId === storeId) return;

        const nextCart = state.cartsByStore[storeId] ?? emptyCart();
        const cartsByStore = state.storeId
          ? { ...state.cartsByStore, [state.storeId]: cartData(state) }
          : state.cartsByStore;
        set({ storeId, cartsByStore, ...nextCart });
      },
      addItem: (newItem) => {
        const items = get().items;
        const existingItemIndex = items.findIndex(
          (item) =>
            cartItemIdentityKey(item.product_id, item.addons, item.observation) ===
            cartItemIdentityKey(newItem.product_id, newItem.addons, newItem.observation),
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
          items: get().items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
        });
      },
      setDeliveryFee: (fee, neighborhood) => {
        set({ deliveryFee: fee, selectedNeighborhood: neighborhood });
      },
      clearCart: () => {
        const state = get();
        const cartsByStore = state.storeId
          ? { ...state.cartsByStore, [state.storeId]: emptyCart() }
          : state.cartsByStore;
        set({ ...emptyCart(), cartsByStore });
      },
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
      name: "cart-storage",
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<CartStore> | undefined;
        return {
          ...state,
          ...emptyCart(),
          storeId: null,
          cartsByStore: {},
        } as CartStore;
      },
    },
  ),
);

export const setCartStoreContext = (storeId: string): void => {
  useCart.getState().setStoreContext(storeId);
};

export const getCartData = (): CartData => cartData(useCart.getState());
