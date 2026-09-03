import { createFileRoute } from "@tanstack/react-router";
import {
  StorePage,
  storeSettingsOptions,
  categoriesWithProductsOptions,
  activeDeliveryFeesOptions,
  buildStoreHead,
} from "@/components/delivery/store-page";
import { DEFAULT_STORE_ID, type StoreSettings } from "@/lib/delivery.functions";

export const Route = createFileRoute("/")({
  component: () => <StorePage storeId={DEFAULT_STORE_ID} />,
  loader: async ({ context }) => {
    const [settings] = await Promise.all([
      context.queryClient.ensureQueryData(storeSettingsOptions(DEFAULT_STORE_ID)),
      context.queryClient.ensureQueryData(categoriesWithProductsOptions(DEFAULT_STORE_ID)),
      context.queryClient.ensureQueryData(activeDeliveryFeesOptions(DEFAULT_STORE_ID)),
    ]);
    return settings as StoreSettings;
  },
  head: ({ loaderData }) => buildStoreHead(loaderData as StoreSettings | undefined),
});
