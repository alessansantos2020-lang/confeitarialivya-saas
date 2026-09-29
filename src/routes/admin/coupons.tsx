import { createFileRoute } from "@tanstack/react-router";
import { useActiveStore } from "@/lib/active-store";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Ticket, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/coupons")({
  component: CouponsAdminPage,
});

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_redemptions: number | null;
  max_redemptions_per_user: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function CouponsAdminPage() {
  const { store } = useActiveStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["adminCoupons", store?.id],
    enabled: Boolean(store?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CouponRow[];
    },
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const normalizedCode = code.trim().toUpperCase();
      const discount = Number(discountValue.replace(",", "."));
      const minimum = Number(minOrder.replace(",", ".")) || 0;
      if (!/^[A-Z0-9_-]{3,30}$/.test(normalizedCode)) {
        throw new Error("Use 3 a 30 caracteres: letras, números, _ ou -.");
      }
      if (!Number.isFinite(discount) || discount <= 0) {
        throw new Error("Informe um desconto válido.");
      }
      if (discountType === "percent" && discount > 100) {
        throw new Error("O desconto percentual não pode passar de 100%.");
      }
      if (!store?.id) throw new Error("Selecione uma loja.");

      const { error } = await supabase.from("coupons").insert({
        store_id: store.id,
        code: normalizedCode,
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: discount,
        min_order_amount: minimum,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        max_redemptions_per_user: 1,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Esse código já existe nesta loja.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cupom criado.");
      setCode("");
      setDescription("");
      setDiscountValue("");
      setMinOrder("0");
      setMaxRedemptions("");
      setExpiresAt("");
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["adminCoupons", store?.id] });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível criar o cupom."),
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active })
        .eq("id", id)
        .eq("store_id", store!.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["adminCoupons", store?.id] }),
    onError: () => toast.error("Não foi possível atualizar o cupom."),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", id)
        .eq("store_id", store!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cupom excluído.");
      void queryClient.invalidateQueries({ queryKey: ["adminCoupons", store?.id] });
    },
    onError: () => toast.error("Não foi possível excluir o cupom."),
  });

  if (!store?.id) {
    return (
      <div className="p-6 text-sm text-slate-500">Selecione uma loja para gerenciar cupons.</div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Ticket className="text-[var(--primary-color)]" size={24} /> Cupons
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Crie cupons para seus clientes usarem no checkout.
          </p>
        </div>
        <Button className="font-bold" onClick={() => setShowForm((value) => !value)}>
          <Plus size={16} className="mr-1" /> Novo cupom
        </Button>
      </header>

      {showForm && (
        <form
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 md:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            createCoupon.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">Código</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="BEMVINDO10"
              maxLength={30}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-description">Descrição (opcional)</Label>
            <Input
              id="coupon-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Desconto de boas-vindas"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de desconto</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as "percent" | "fixed")}
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-discount">Desconto</Label>
            <Input
              id="coupon-discount"
              type="number"
              min="0.01"
              max={discountType === "percent" ? "100" : undefined}
              step="0.01"
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-minimum">Pedido mínimo (R$)</Label>
            <Input
              id="coupon-minimum"
              type="number"
              min="0"
              step="0.01"
              value={minOrder}
              onChange={(event) => setMinOrder(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-limit">Limite total de usos (opcional)</Label>
            <Input
              id="coupon-limit"
              type="number"
              min="1"
              step="1"
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-expiry">Validade (opcional)</Label>
            <Input
              id="coupon-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCoupon.isPending} className="font-bold">
              {createCoupon.isPending && <Loader2 size={15} className="mr-2 animate-spin" />}
              Criar cupom
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Ticket className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-bold text-slate-700">Nenhum cupom criado</p>
          <p className="mt-1 text-sm text-slate-500">Crie um cupom para seus clientes.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {coupons.map((coupon) => (
            <article
              key={coupon.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-black tracking-wide text-slate-900">
                    {coupon.code}
                  </span>
                  <Badge variant={coupon.is_active ? "default" : "secondary"}>
                    {coupon.is_active ? "Ativo" : "Pausado"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-bold text-[var(--primary-color)]">
                  {coupon.discount_type === "percent"
                    ? `${coupon.discount_value}% OFF`
                    : `${money(coupon.discount_value)} OFF`}
                  {Number(coupon.min_order_amount) > 0 &&
                    ` · mínimo ${money(Number(coupon.min_order_amount))}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {coupon.description || "Sem descrição"}
                  {coupon.expires_at && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      até {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={coupon.is_active}
                  aria-label={coupon.is_active ? "Pausar cupom" : "Ativar cupom"}
                  onCheckedChange={(is_active) => updateCoupon.mutate({ id: coupon.id, is_active })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir cupom"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => {
                    if (window.confirm(`Excluir o cupom ${coupon.code}?`)) {
                      deleteCoupon.mutate(coupon.id);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
