import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/lib/active-store";
import {
  Plus,
  PlusCircle,
  Pencil,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Star,
  StarOff,
  Search,
  ChevronUp,
  ChevronDown,
  CalendarClock,
} from "lucide-react";
import { ProductForm } from "@/components/admin/products/product-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getPromotionStatus, getDiscountPercent, type PromotionStatus } from "@/lib/promotions";
import { getEligibleFeaturedProducts } from "@/lib/featured-products";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category, AddonGroupOption, Product } from "@/components/admin/products/types";
import type { Database } from "@/integrations/supabase/types";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
type ProductCreateInput = ProductInsert & { addon_group_ids?: string[] };
type ProductUpdateInput = ProductUpdate & { id: string; addon_group_ids?: string[] };

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type PromoBadge = { label: string; className: string } | null;
const PROMO_BADGE: Record<PromotionStatus, PromoBadge> = {
  none: null,
  active: { label: "Em promoção", className: "bg-rose-100 text-rose-700 border-rose-200" },
  scheduled: { label: "Agendada", className: "bg-sky-100 text-sky-700 border-sky-200" },
  expired: { label: "Encerrada", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const Route = createFileRoute("/admin/products")({
  beforeLoad: () => {
    return;
  },
  component: ProductsPage,
});

function ProductsPage() {
  const { storeId, hasFeature } = useActiveStore();
  const canUsePromotions = hasFeature("promotions");
  const canUseAddons = hasFeature("addons");
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<"all" | "on_sale" | "no_sale">("all");
  const [newProductImage, setNewProductImage] = useState("");
  const [editProductImage, setEditProductImage] = useState("");
  const [newHasPromo, setNewHasPromo] = useState(false);
  const [editHasPromo, setEditHasPromo] = useState(false);
  const [newAddonGroups, setNewAddonGroups] = useState<string[]>([]);
  const [editAddonGroups, setEditAddonGroups] = useState<string[]>([]);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const { data: settings } = useQuery({
    queryKey: ["storeSettings", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("featured_section_title")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [sectionTitle, setSectionTitle] = useState("Em destaque");

  useEffect(() => {
    setSectionTitle(settings?.featured_section_title || "Em destaque");
  }, [settings?.featured_section_title, storeId]);

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(id, name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch Categories for the selector
  const { data: categories } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
  });

  // Grupos de adicionais disponíveis para ligar ao produto
  const { data: addonGroups } = useQuery({
    queryKey: ["addon-group-options", storeId],
    enabled: canUseAddons,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, name, is_required, min_quantity, max_quantity")
        .eq("store_id", storeId)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as AddonGroupOption[];
    },
  });

  // Vínculos produto <-> grupo já gravados, da loja toda de uma vez
  const { data: productAddonLinks } = useQuery({
    queryKey: ["product-addon-groups", storeId],
    enabled: canUseAddons,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("product_id, group_id")
        .eq("store_id", storeId);

      if (error) throw error;

      const byProduct: Record<string, string[]> = {};
      for (const link of data || []) {
        byProduct[link.product_id] = [...(byProduct[link.product_id] || []), link.group_id];
      }
      return byProduct;
    },
  });

  /**
   * Grava só a diferença: apaga os grupos desmarcados e insere os novos.
   * `store_id` vai junto porque a política do banco exige a loja na linha.
   */
  const syncAddonGroups = async (productId: string, groupIds: string[]) => {
    const current = productAddonLinks?.[productId] || [];
    const toRemove = current.filter((id) => !groupIds.includes(id));
    const toAdd = groupIds.filter((id) => !current.includes(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from("product_addon_groups")
        .delete()
        .eq("product_id", productId)
        .eq("store_id", storeId)
        .in("group_id", toRemove);
      if (error) throw error;
    }

    if (toAdd.length) {
      const { error } = await supabase
        .from("product_addon_groups")
        .insert(toAdd.map((group_id) => ({ product_id: productId, group_id, store_id: storeId })));
      if (error) throw error;
    }
  };

  const createMutation = useMutation({
    mutationFn: async (newProduct: ProductCreateInput) => {
      const { category, addon_group_ids, ...insertData } = newProduct;
      const { data, error } = await supabase
        .from("products")
        .insert([{ ...insertData, store_id: storeId }])
        .select("*, category:categories(id, name)")
        .single();
      if (error) throw error;
      if (addon_group_ids?.length) await syncAddonGroups(data.id, addon_group_ids);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-addon-groups", storeId] });
      setIsAddOpen(false);
      toast.success("Produto criado com sucesso!");
    },
    onError: (error: unknown) => toast.error(`Erro ao criar produto: ${errorMessage(error)}`),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: ProductUpdateInput) => {
      const { id, category, addon_group_ids, ...updateData } = updates;
      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id)
        .eq("store_id", storeId)
        .select("*, category:categories(id, name)")
        .single();
      if (error) throw error;
      // Só sincroniza quando o formulário mandou a lista. Os interruptores
      // rápidos da tabela não mandam, então não mexem nos adicionais.
      if (addon_group_ids) await syncAddonGroups(id, addon_group_ids);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-addon-groups", storeId] });
      setEditingProduct(null);
      toast.success("Produto atualizado!");
    },
    onError: (error: unknown) => toast.error(`Erro ao atualizar: ${errorMessage(error)}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First check if product is used in order_items
      const { count: orderItemsCount, error: countError } = await supabase
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("product_id", id);

      if (countError) throw countError;
      if (orderItemsCount && orderItemsCount > 0) {
        throw new Error(
          `Este produto possui ${orderItemsCount} pedido(s) vinculado(s) e não pode ser excluído. Desative-o em vez disso.`,
        );
      }

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Produto excluído!");
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  // handleFileUpload was removed in favor of ImageUpload component

  /**
   * Lê os campos de promoção do formulário e valida.
   * Devolve `null` quando algo está errado (o erro já foi mostrado na tela).
   * Promoção desligada NÃO apaga o preço promocional guardado.
   */
  const readPromoFields = (
    formData: FormData,
    price: number,
    hasPromo: boolean,
    current?: Partial<Product> | null,
  ) => {
    if (!canUsePromotions) return {};

    const salePriceStr = (formData.get("sale_price") as string) || "";
    const salePrice = salePriceStr === "" ? null : parseFloat(salePriceStr);
    const startAt = fromLocalInput((formData.get("sale_start_at") as string) || "");
    const endAt = fromLocalInput((formData.get("sale_end_at") as string) || "");

    if (salePrice !== null && (isNaN(salePrice) || salePrice <= 0)) {
      toast.error("O preço promocional deve ser maior que zero.");
      return null;
    }
    if (salePrice !== null && salePrice >= price) {
      toast.error("O preço promocional precisa ser menor que o preço normal.");
      return null;
    }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      toast.error("A data de término precisa ser depois da data de início.");
      return null;
    }
    if (hasPromo && salePrice === null) {
      toast.error("Informe o preço promocional para ativar a promoção.");
      return null;
    }

    return {
      is_on_sale: hasPromo,
      sale_price: salePrice ?? current?.sale_price ?? null,
      sale_start_at: startAt,
      sale_end_at: endAt,
    };
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newProductImage) {
      toast.error("Por favor, envie uma imagem para o produto.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const priceStr = formData.get("price") as string;
    const price = parseFloat(priceStr);

    if (isNaN(price) || price <= 0) {
      toast.error("O preço deve ser um valor positivo.");
      return;
    }

    const promo = readPromoFields(formData, price, newHasPromo);
    if (promo === null) return;

    const newProduct = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: price,
      category_id: formData.get("category_id") as string,
      image_url: newProductImage,
      is_available: true,
      is_featured: false,
      ...promo,
      addon_group_ids: canUseAddons ? newAddonGroups : [],
    };

    if (!newProduct.category_id) {
      toast.error("Selecione uma categoria");
      return;
    }

    createMutation.mutate(newProduct);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct?.id) return;

    if (!editProductImage && !editingProduct.image_url) {
      toast.error("O produto deve ter uma imagem.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const priceStr = formData.get("price") as string;
    const price = parseFloat(priceStr);

    if (isNaN(price) || price <= 0) {
      toast.error("O preço deve ser um valor positivo.");
      return;
    }

    const promo = readPromoFields(formData, price, editHasPromo, editingProduct);
    if (promo === null) return;

    const updates = {
      id: editingProduct.id,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: price,
      category_id: formData.get("category_id") as string,
      image_url: editProductImage || editingProduct.image_url || "",
      ...promo,
      ...(canUseAddons ? { addon_group_ids: editAddonGroups } : {}),
    };

    updateMutation.mutate(updates);
  };

  const sortedFeaturedProducts = useMemo(
    () =>
      [...(products || [])]
        .filter((product) => product.is_featured)
        .sort(
          (first, second) =>
            first.featured_sort_order - second.featured_sort_order ||
            first.name.localeCompare(second.name),
        ),
    [products],
  );

  const featuredProducts = sortedFeaturedProducts;
  const filteredFeaturedProducts = (products || []).filter((product) =>
    product.name.toLocaleLowerCase("pt-BR").includes(featuredSearch.toLocaleLowerCase("pt-BR")),
  );

  const saveSectionTitle = async () => {
    const title = sectionTitle.trim();
    if (!title || title.length > 80) return;
    const { data: existing, error: readError } = await supabase
      .from("store_settings")
      .select("id")
      .eq("store_id", storeId)
      .maybeSingle();
    if (readError) {
      toast.error("Não foi possível salvar o título da seção.");
      return;
    }
    const result = existing
      ? await supabase
          .from("store_settings")
          .update({ featured_section_title: title })
          .eq("store_id", storeId)
      : await supabase
          .from("store_settings")
          .insert({ store_id: storeId, featured_section_title: title });
    if (result.error) {
      toast.error("Não foi possível salvar o título da seção.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["storeSettings", storeId] });
    toast.success("Título dos destaques salvo.");
  };

  const setFeatured = (product: Product, active: boolean) => {
    const sortOrder = active ? sortedFeaturedProducts.length : product.featured_sort_order;
    updateMutation.mutate({
      id: product.id,
      is_featured: active,
      featured_sort_order: sortOrder,
      ...(active ? {} : { featured_badge: null, featured_start_at: null, featured_end_at: null }),
    });
  };

  const updateFeaturedField = (
    product: Product,
    field: "featured_badge" | "featured_start_at" | "featured_end_at",
    value: string | null,
  ) => {
    const next = { ...product, [field]: value };
    if (
      next.featured_start_at &&
      next.featured_end_at &&
      next.featured_end_at <= next.featured_start_at
    ) {
      toast.error("A data final precisa ser posterior à data inicial.");
      return;
    }
    updateMutation.mutate({ id: product.id, [field]: value });
  };

  const moveFeaturedProduct = (productId: string, direction: -1 | 1) => {
    const index = sortedFeaturedProducts.findIndex((product) => product.id === productId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sortedFeaturedProducts.length) return;
    const current = sortedFeaturedProducts[index];
    const neighbor = sortedFeaturedProducts[target];
    if (!current || !neighbor) return;
    const updates = [
      supabase
        .from("products")
        .update({ featured_sort_order: neighbor.featured_sort_order })
        .eq("id", current.id)
        .eq("store_id", storeId),
      supabase
        .from("products")
        .update({ featured_sort_order: current.featured_sort_order })
        .eq("id", neighbor.id)
        .eq("store_id", storeId),
    ];
    void Promise.all(updates).then((results) => {
      const error = results.find((result) => result.error)?.error;
      if (error) {
        toast.error("Não foi possível alterar a ordem dos destaques.");
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    });
  };

  const filteredProducts = products?.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (promoFilter === "on_sale") return getPromotionStatus(p) === "active";
    if (promoFilter === "no_sale") return getPromotionStatus(p) !== "active";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produtos</h1>
          <p className="text-slate-500 text-sm">Gerencie o catálogo da loja</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar produto..."
              className="pl-10 w-full md:w-64 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (!open) {
                setNewProductImage("");
                setNewHasPromo(false);
                setNewAddonGroups([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
                <Plus size={18} />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Produto</DialogTitle>
              </DialogHeader>
              <ProductForm
                mode="create"
                storeId={storeId}
                categories={categories}
                addonGroups={addonGroups}
                canUseAddons={canUseAddons}
                canUsePromotions={canUsePromotions}
                image={newProductImage}
                onImageChange={setNewProductImage}
                hasPromo={newHasPromo}
                onHasPromoChange={setNewHasPromo}
                selectedAddonGroups={newAddonGroups}
                onAddonGroupsChange={setNewAddonGroups}
                onSubmit={handleCreate}
                onCancel={() => setIsAddOpen(false)}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
            Produtos em destaque
          </CardTitle>
          <p className="text-sm text-slate-500">
            Escolha o que aparece primeiro na vitrine. Produtos também continuam nas categorias.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="featured-section-title">Título da seção</Label>
              <Input
                id="featured-section-title"
                maxLength={80}
                value={sectionTitle}
                onChange={(event) => setSectionTitle(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={sectionTitle.trim().length === 0 || sectionTitle.trim().length > 80}
              onClick={() => void saveSectionTitle()}
            >
              Salvar título
            </Button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              aria-label="Buscar produtos para destacar"
              placeholder="Buscar produto para destacar..."
              className="pl-10"
              value={featuredSearch}
              onChange={(event) => setFeaturedSearch(event.target.value)}
            />
          </div>
          {!filteredFeaturedProducts.length ? (
            <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">
              Nenhum produto encontrado. Marque um produto como destaque para preencher esta seção.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {filteredFeaturedProducts.map((product) => {
                const position = featuredProducts.findIndex((item) => item.id === product.id);
                const canShow = product.is_available && product.category?.name;
                return (
                  <div
                    key={product.id}
                    className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_170px_210px_auto] md:items-end"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={product.is_featured}
                        onCheckedChange={(checked) => setFeatured(product, checked)}
                        aria-label={`${product.is_featured ? "Remover" : "Adicionar"} ${product.name} dos destaques`}
                      />
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.category?.name || "Sem categoria"} ·{" "}
                          {formatCurrency(product.price)}
                        </p>
                        {!canShow && (
                          <p className="text-xs text-amber-700">
                            Indisponível na vitrine enquanto o produto estiver inativo.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`featured-badge-${product.id}`}>Selo opcional</Label>
                      <Input
                        id={`featured-badge-${product.id}`}
                        maxLength={30}
                        placeholder="Ex.: Novidade"
                        defaultValue={product.featured_badge || ""}
                        onBlur={(event) => {
                          const badge = event.currentTarget.value.trim() || null;
                          if (badge !== product.featured_badge) {
                            updateFeaturedField(product, "featured_badge", badge);
                          }
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor={`featured-start-${product.id}`}>Exibir a partir de</Label>
                        <Input
                          id={`featured-start-${product.id}`}
                          type="datetime-local"
                          defaultValue={toLocalInput(product.featured_start_at)}
                          onBlur={(event) => {
                            const value = fromLocalInput(event.currentTarget.value);
                            if (value !== product.featured_start_at)
                              updateFeaturedField(product, "featured_start_at", value);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`featured-end-${product.id}`}>Exibir até</Label>
                        <Input
                          id={`featured-end-${product.id}`}
                          type="datetime-local"
                          defaultValue={toLocalInput(product.featured_end_at)}
                          onBlur={(event) => {
                            const value = fromLocalInput(event.currentTarget.value);
                            if (value !== product.featured_end_at)
                              updateFeaturedField(product, "featured_end_at", value);
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={position <= 0 || updateMutation.isPending}
                        aria-label={`Mover ${product.name} para cima`}
                        onClick={() => moveFeaturedProduct(product.id, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={
                          position < 0 ||
                          position >= featuredProducts.length - 1 ||
                          updateMutation.isPending
                        }
                        aria-label={`Mover ${product.name} para baixo`}
                        onClick={() => moveFeaturedProduct(product.id, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {featuredProducts.length > 0 && (
            <p className="text-xs text-slate-500">
              {featuredProducts.length}{" "}
              {featuredProducts.length === 1 ? "produto aparece" : "produtos aparecem"} na vitrine
              neste momento.
            </p>
          )}
        </CardContent>
      </Card>

      {canUsePromotions && (
        <div className="flex gap-2">
          {(
            [
              ["all", "Todos"],
              ["on_sale", "Em promoção"],
              ["no_sale", "Sem promoção"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setPromoFilter(value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                promoFilter === value
                  ? "bg-pink-600 text-white border-pink-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-pink-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoadingProducts ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-pink-600" size={32} />
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            {search ? "Nenhum produto encontrado para sua busca." : "Nenhum produto cadastrado."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Foto</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                {canUsePromotions && (
                  <>
                    <TableHead>Promoção</TableHead>
                    <TableHead>Preço promocional</TableHead>
                  </>
                )}
                <TableHead>Status</TableHead>
                <TableHead>Destaque</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts?.map((product) => {
                const promoStatus = getPromotionStatus(product);
                const promoBadge = PROMO_BADGE[promoStatus];
                const linkedAddonGroups = productAddonLinks?.[product.id]?.length ?? 0;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover border bg-slate-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/100x100?text=Erro";
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-700">{product.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">
                        {product.description || "Sem descrição"}
                      </div>
                      {canUseAddons && linkedAddonGroups > 0 && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <PlusCircle size={10} />
                          {linkedAddonGroups === 1
                            ? "1 grupo de adicionais"
                            : `${linkedAddonGroups} grupos de adicionais`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {product.category?.name || "Sem Categoria"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {promoStatus === "active" ? (
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrency(product.price)}
                          </span>
                          <span className="text-rose-600">
                            {formatCurrency(product.sale_price!)}
                          </span>
                        </div>
                      ) : (
                        formatCurrency(product.price)
                      )}
                    </TableCell>
                    {canUsePromotions && (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={product.is_on_sale}
                              disabled={!product.is_on_sale && product.sale_price == null}
                              onCheckedChange={(checked) =>
                                updateMutation.mutate({ id: product.id, is_on_sale: checked })
                              }
                            />
                            {promoBadge ? (
                              <Badge
                                variant="outline"
                                className={`font-normal text-[10px] ${promoBadge.className}`}
                              >
                                {promoBadge.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {product.sale_price == null ? "Sem preço" : "Desligada"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.sale_price != null ? (
                            <span className="flex items-center gap-1.5">
                              {formatCurrency(product.sale_price)}
                              <span className="text-[10px] font-bold text-rose-500">
                                -{getDiscountPercent(product.price, product.sale_price)}%
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={product.is_available}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({ id: product.id, is_available: checked })
                          }
                        />
                        <span className="text-xs text-slate-500">
                          {product.is_available ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: product.id,
                            is_featured: !product.is_featured,
                          })
                        }
                        className="text-slate-300 hover:text-yellow-400 transition-colors"
                      >
                        {product.is_featured ? (
                          <Star size={20} className="fill-yellow-400 text-yellow-400" />
                        ) : (
                          <StarOff size={20} />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Dialog
                        open={editingProduct?.id === product.id}
                        onOpenChange={(open) => !open && setEditingProduct(null)}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingProduct(product);
                              setEditProductImage("");
                              setEditHasPromo(product.is_on_sale);
                              setEditAddonGroups(productAddonLinks?.[product.id] || []);
                            }}
                          >
                            <Pencil size={16} className="text-slate-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Editar Produto</DialogTitle>
                          </DialogHeader>
                          <ProductForm
                            mode="edit"
                            product={product}
                            storeId={storeId}
                            categories={categories}
                            addonGroups={addonGroups}
                            canUseAddons={canUseAddons}
                            canUsePromotions={canUsePromotions}
                            image={editProductImage}
                            onImageChange={setEditProductImage}
                            hasPromo={editHasPromo}
                            onHasPromoChange={setEditHasPromo}
                            selectedAddonGroups={editAddonGroups}
                            onAddonGroupsChange={setEditAddonGroups}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditingProduct(null)}
                            isPending={updateMutation.isPending}
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir "{product.name}"? Esta ação não pode ser
                              desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(product.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
