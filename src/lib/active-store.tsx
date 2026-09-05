import { createContext, useContext, type ReactNode } from "react";
import type { Store } from "./delivery.functions";
import { setSelectedStoreId, type StoreMembership } from "./store-context";
import type { FeatureId } from "./features.functions";

type ActiveStoreValue = {
  store: Store;
  storeId: string;
  memberships: StoreMembership[];
  features: FeatureId[];
  hasFeature: (feature: FeatureId) => boolean;
  switchStore: (storeId: string) => void;
};

const ActiveStoreContext = createContext<ActiveStoreValue | null>(null);

export function ActiveStoreProvider({
  store,
  memberships,
  features,
  onSwitch,
  children,
}: {
  store: Store;
  memberships: StoreMembership[];
  features: FeatureId[];
  onSwitch: (storeId: string) => void;
  children: ReactNode;
}) {
  const switchStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    onSwitch(storeId);
  };

  return (
    <ActiveStoreContext.Provider
      value={{
        store,
        storeId: store.id,
        memberships,
        features,
        hasFeature: (feature) => features.includes(feature),
        switchStore,
      }}
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
