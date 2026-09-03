import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import {
  StorePage,
  storeSettingsOptions,
  categoriesWithProductsOptions,
  activeDeliveryFeesOptions,
  buildStoreHead,
} from "@/components/delivery/store-page";
import { getStoreBySlug, type StoreData } from "@/lib/delivery.functions";
import { Button } from "@/components/ui/button";
import { Store as StoreIcon, ArrowLeft } from "lucide-react";

export const storeBySlugOptions = (slug: string) =>
  queryOptions({
    queryKey: ["storeBySlug", slug.toLowerCase().trim()],
    queryFn: () => getStoreBySlug(slug),
  });

export const Route = createFileRoute("/$slug")({
  component: SlugStorePage,
  loader: async ({ context, params }) => {
    const storeData = await context.queryClient.ensureQueryData(
      storeBySlugOptions(params.slug)
    );

    if (!storeData) {
      throw notFound();
    }

    const [settings] = await Promise.all([
      context.queryClient.ensureQueryData(storeSettingsOptions(storeData.store.id)),
      context.queryClient.ensureQueryData(categoriesWithProductsOptions(storeData.store.id)),
      context.queryClient.ensureQueryData(activeDeliveryFeesOptions(storeData.store.id)),
    ]);

    return { storeData, settings };
  },
  head: ({ loaderData }) => {
    return buildStoreHead(loaderData?.settings);
  },
  notFoundComponent: StoreNotFound,
});

function SlugStorePage() {
  const { slug } = Route.useParams();
  const { data: storeData } = useSuspenseQuery(storeBySlugOptions(slug)) as {
    data: StoreData;
  };

  return <StorePage storeId={storeData.store.id} />;
}

function StoreNotFound() {
  const { slug } = Route.useParams();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
          <StoreIcon className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Loja não encontrada
          </h1>
          <p className="text-slate-500 text-sm">
            Não encontramos nenhuma loja ativa com o endereço{" "}
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              /{slug}
            </span>
            .
          </p>
        </div>

        <div className="pt-2">
          <Button asChild className="w-full h-12 rounded-xl">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ir para página inicial
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
