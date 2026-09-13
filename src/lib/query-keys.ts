export const queryKeys = {
  storeBySlug: (slug: string) => ["storeBySlug", slug.toLowerCase().trim()] as const,
  storeSettings: (storeId: string) => ["storeSettings", storeId] as const,
  storeSettingsDashed: (storeId: string) => ["store-settings", storeId] as const,
  categories: (storeId: string) => ["categories", storeId] as const,
  deliveryFees: (storeId: string) => ["delivery-fees", storeId] as const,
  salesReport: (storeId: string, dateRange: { start: string; end: string }) =>
    ["salesReport", storeId, dateRange] as const,
  staffOrders: (storeId: string) => ["staff-orders", storeId] as const,
  staffHistory: (storeId: string, startDate: string, endDate: string) =>
    ["staff-history", storeId, startDate, endDate] as const,
  adminOrders: (storeId: string) => ["admin-orders", storeId] as const,
  superUsers: () => ["super-users"] as const,
  superStores: () => ["super-stores"] as const,
  superPlans: () => ["super-plans"] as const,
  superFeatures: () => ["super-features"] as const,
  saasSettings: () => ["saas-settings"] as const,
} as const;
