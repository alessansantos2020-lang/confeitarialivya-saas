import { PlusCircle, Tag, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { AddonGroupOption, Category, Product } from "./types";

export function AddonGroupPicker({
  groups,
  selected,
  onToggle,
}: {
  groups: AddonGroupOption[] | undefined;
  selected: string[];
  onToggle: (groupId: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-3 border rounded-lg p-3 bg-slate-50/60 border-slate-200">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <PlusCircle size={14} className="text-slate-500" /> Adicionais
      </label>
      {!groups?.length ? (
        <p className="text-xs text-slate-500">
          Nenhum grupo de adicionais cadastrado. Crie os grupos na tela{" "}
          <span className="font-medium">Adicionais</span> para poder lig�-los aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="flex items-start gap-2.5 cursor-pointer rounded-md p-1.5 hover:bg-white"
            >
              <Checkbox
                checked={selected.includes(group.id)}
                onCheckedChange={(checked) => onToggle(group.id, checked === true)}
                className="mt-0.5"
              />
              <span className="leading-tight">
                <span className="block text-sm font-medium text-slate-700">{group.name}</span>
                <span className="block text-xs text-slate-400">
                  {group.is_required
                    ? `Obrigat�rio � m�n ${group.min_quantity}`
                    : `Opcional � m�x ${group.max_quantity}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export type ProductFormProps = {
  mode: "create" | "edit";
  product?: Product;
  storeId: string;
  categories: Category[] | undefined;
  addonGroups: AddonGroupOption[] | undefined;
  canUseAddons: boolean;
  canUsePromotions: boolean;
  image: string;
  onImageChange: (url: string) => void;
  hasPromo: boolean;
  onHasPromoChange: (value: boolean) => void;
  selectedAddonGroups: string[];
  onAddonGroupsChange: (updater: (previous: string[]) => string[]) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isPending: boolean;
};

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ProductForm({
  mode,
  product,
  storeId,
  categories,
  addonGroups,
  canUseAddons,
  canUsePromotions,
  image,
  onImageChange,
  hasPromo,
  onHasPromoChange,
  selectedAddonGroups,
  onAddonGroupsChange,
  onSubmit,
  onCancel,
  isPending,
}: ProductFormProps) {
  const isEdit = mode === "edit";
  return (
    <form onSubmit={onSubmit} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <label className="text-sm font-medium">Nome do Produto</label>
          <Input
            name="name"
            placeholder={isEdit ? undefined : "Ex: Nome do produto"}
            defaultValue={product?.name}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Pre�o (R$)</label>
          <Input
            name="price"
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={product?.price}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Categoria</label>
          <Select
            name="category_id"
            required
            {...(product?.category_id ? { defaultValue: product.category_id } : {})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Imagem do Produto</label>
        <ImageUpload
          value={image || (product?.image_url ?? "")}
          storeId={storeId}
          onChange={(url) => onImageChange(url || "")}
          folder="products"
          className="max-w-[220px]"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Descri��o</label>
        <Textarea
          name="description"
          placeholder={isEdit ? undefined : "Detalhes do produto..."}
          defaultValue={product?.description || ""}
          rows={3}
        />
      </div>
      {canUseAddons && (
        <AddonGroupPicker
          groups={addonGroups}
          selected={selectedAddonGroups}
          onToggle={(groupId, checked) =>
            onAddonGroupsChange((prev) =>
              checked ? [...prev, groupId] : prev.filter((id) => id !== groupId),
            )
          }
        />
      )}
      {canUsePromotions && (
        <div className="space-y-3 border rounded-lg p-3 bg-rose-50/50 border-rose-100">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Tag size={14} className="text-rose-500" /> Produto em promo��o
            </label>
            <Switch checked={hasPromo} onCheckedChange={onHasPromoChange} />
          </div>
          {(mode === "create" ? hasPromo : true) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-slate-500">Pre�o promocional (R$)</label>
                <Input
                  name="sale_price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={product?.sale_price ?? ""}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">In�cio (opcional)</label>
                <Input
                  name="sale_start_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(product?.sale_start_at)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Fim (opcional)</label>
                <Input
                  name="sale_end_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(product?.sale_end_at)}
                />
              </div>
            </div>
          )}
          {isEdit && (
            <p className="text-[10px] text-slate-400">
              Desligar a promo��o n�o apaga o pre�o promocional � ele fica guardado pra pr�xima vez.
            </p>
          )}
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : isEdit ? "Salvar" : "Criar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
