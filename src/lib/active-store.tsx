import { createContext, useContext, type ReactNode } from "react";
import type { Store } from "./delivery.functions";
import { setSelectedStoreId, type StoreMembership } from "./store-context";

type ActiveStoreValue = {
  store: Store;
  storeId: string;
  memberships: StoreMembership[];
  switchStore: (storeId: string) => void;
};

const ActiveStoreContext = createContext<ActiveStoreValue | null>(null);

export function ActiveStoreProvider({
  store,
  memberships,
  onSwitch,
  children,
}: {
  store: Store;
  memberships: StoreMembership[];
  onSwitch: (storeId: string) => void;
  children: ReactNode;
}) {
  const switchStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    onSwitch(storeId);
  };

  return (
    <ActiveStoreContext.Provider
      value={{ store, storeId: store.id, memberships, switchStore }}
    >
      {children}
    </ActiveStoreContext.Provider>
  );
}

export function useActiveStore(): ActiveStoreValue {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) {
    throw new Error("useActiveStore precisa estar dentro de <ActiveStoreProvider>");
  }
  return ctx;
}
