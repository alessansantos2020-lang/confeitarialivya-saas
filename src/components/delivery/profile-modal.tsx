/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Package,
  MapPin,
  Heart,
  CreditCard,
  Bell,
  Gift,
  Settings,
  LogOut,
  ChevronRight,
  Pencil,
  UserRound,
  Ticket,
  Loader2,
  Check,
  Copy,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  getCustomerSession,
  onCustomerAuthChange,
  signOutCustomer,
  updateCustomerProfile,
  type CustomerSession,
} from "@/lib/customer-auth.functions";
import {
  getMyOrders,
  getMyAddresses,
  saveMyAddress,
  deleteMyAddress,
  getMyCoupons,
  copyCouponCode,
  type CustomerOrder,
  type CustomerAddress,
  type MyCoupon,
} from "@/lib/customer-account.functions";

type ProfileModalProps = {
  open: boolean;
  storeId: string;
  storeName: string;
  paymentMethodsLabel: string[];
  formatCurrency: (value: number) => string;
  onLogin: () => void;
  onClose: () => void;
};

type Section =
  null | "orders" | "addresses" | "favorites" | "payments" | "coupons" | "edit" | "signout";

export function ProfileModal({
  open,
  storeId,
  storeName,
  paymentMethodsLabel,
  formatCurrency,
  onLogin,
  onClose,
}: ProfileModalProps) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [section, setSection] = useState<Section>(null);

  useEffect(
    () =>
      onCustomerAuthChange((value) => {
        setSession(value);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (open) setSection(null);
  }, [open]);

  if (!open) return null;

  const accountRows: { key: Section; icon: any; label: string; hint?: string }[] = [
    { key: "orders", icon: Package, label: "Meus pedidos", hint: "Histórico nesta loja" },
    { key: "addresses", icon: MapPin, label: "Meus endereços", hint: "Entrega rápida" },
    { key: "favorites", icon: Heart, label: "Favoritos", hint: "Em breve" },
    {
      key: "payments",
      icon: CreditCard,
      label: "Formas de pagamento",
      hint: "Disponíveis na loja",
    },
  ];
  const prefRows: { key: Section; icon: any; label: string; hint?: string }[] = [
    { key: "orders", icon: Bell, label: "Notificações", hint: "Em breve" },
    { key: "coupons", icon: Gift, label: "Cupons e benefícios", hint: "Seus descontos" },
    { key: "favorites", icon: Settings, label: "Configurações", hint: "Em breve" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-[calc(100%-32px)] max-w-sm flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
            <UserRound size={20} /> Perfil
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar perfil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {!authReady ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : !session ? (
            <SignedOutView onLogin={onLogin} />
          ) : (
            <SignedInView
              session={session}
              storeId={storeId}
              storeName={storeName}
              paymentMethodsLabel={paymentMethodsLabel}
              formatCurrency={formatCurrency}
              accountRows={accountRows}
              prefRows={prefRows}
              section={section}
              setSection={setSection}
              onSessionUpdate={setSession}
              onSignOut={async () => {
                await signOutCustomer();
                setSection(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SignedOutView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
        👤
      </div>
      <div className="space-y-1">
        <p className="font-bold text-slate-900">Entre na sua conta</p>
        <p className="text-sm text-slate-500">
          Acompanhe pedidos, salve endereços e use cupons exclusivos.
        </p>
      </div>
      <Button className="h-11 w-full font-bold" onClick={onLogin}>
        Entrar ou criar conta
      </Button>
    </div>
  );
}

function SignedInView({
  session,
  storeId,
  storeName,
  paymentMethodsLabel,
  formatCurrency,
  accountRows,
  prefRows,
  section,
  setSection,
  onSessionUpdate,
  onSignOut,
}: {
  session: CustomerSession;
  storeId: string;
  storeName: string;
  paymentMethodsLabel: string[];
  formatCurrency: (value: number) => string;
  accountRows: { key: Section; icon: any; label: string; hint?: string }[];
  prefRows: { key: Section; icon: any; label: string; hint?: string }[];
  section: Section;
  setSection: (value: Section) => void;
  onSessionUpdate: (session: CustomerSession) => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <>
      {/* Topo do perfil */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-black text-slate-400">
          {session.avatarUrl ? (
            <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (session.name[0] ?? "?").toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">{session.name}</p>
          <p className="truncate text-sm text-slate-500">{session.phone || session.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setSection("edit")}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
        >
          <Pencil size={13} /> Editar
        </button>
      </div>

      <div className="px-5">
        <p className="pb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Minha conta
        </p>
      </div>
      <div className="mx-4 mb-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
        {accountRows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => setSection(row.key)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            <row.icon size={18} className="shrink-0 text-[var(--primary-color)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">{row.label}</span>
              {row.hint && <span className="block text-xs text-slate-400">{row.hint}</span>}
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      <div className="px-5">
        <p className="pb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Preferências
        </p>
      </div>
      <div className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
        {prefRows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => setSection(row.key)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            <row.icon size={18} className="shrink-0 text-[var(--primary-color)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">{row.label}</span>
              {row.hint && <span className="block text-xs text-slate-400">{row.hint}</span>}
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      <div className="p-4">
        <button
          type="button"
          onClick={() => setSection("signout")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>

      {/* Sub-diálogos */}
      <OrdersSection
        open={section === "orders"}
        storeId={storeId}
        formatCurrency={formatCurrency}
        onClose={() => setSection(null)}
      />
      <AddressesSection open={section === "addresses"} onClose={() => setSection(null)} />
      <CouponsSection
        open={section === "coupons"}
        storeId={storeId}
        formatCurrency={formatCurrency}
        onClose={() => setSection(null)}
      />
      <SimpleListSection
        open={section === "payments"}
        title="Formas de pagamento"
        icon={CreditCard}
        emptyText="A loja ainda não configurou formas de pagamento."
        items={paymentMethodsLabel.map((label) => ({ id: label, label }))}
        onClose={() => setSection(null)}
      />
      <SimpleListSection
        open={section === "favorites"}
        title="Favoritos"
        icon={Heart}
        emptyText="Em breve você poderá favoritar produtos."
        items={[]}
        onClose={() => setSection(null)}
      />

      <EditProfileDialog
        open={section === "edit"}
        session={session}
        onSave={async (name, phone) => {
          await updateCustomerProfile({ name, phone });
          onSessionUpdate({ ...session, name, phone });
          setSection(null);
        }}
        onClose={() => setSection(null)}
      />

      <Dialog open={section === "signout"} onOpenChange={(value) => !value && setSection(null)}>
        <DialogContent className="max-w-[320px] gap-0 rounded-2xl p-5" hideClose>
          <DialogTitle className="text-lg font-black">Sair da conta?</DialogTitle>
          <p className="mt-1 text-sm text-slate-500">Você poderá entrar novamente quando quiser.</p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1 font-bold"
              onClick={() => setSection(null)}
            >
              Cancelar
            </Button>
            <Button
              className="h-10 flex-1 bg-red-600 font-bold text-white hover:bg-red-700"
              onClick={() => void onSignOut()}
            >
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col">
      <div className="flex shrink-0 items-center justify-between px-5 py-3">
        <h3 className="font-black text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

function OrdersSection({
  open,
  storeId,
  formatCurrency,
  onClose,
}: {
  open: boolean;
  storeId: string;
  formatCurrency: (value: number) => string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrders(null);
    setError("");
    getMyOrders(storeId)
      .then(setOrders)
      .catch((err: Error) => setError(err.message));
  }, [open, storeId]);

  if (!open) return null;

  const statusLabel: Record<string, string> = {
    pending: "Aguardando confirmação",
    confirmed: "Confirmado",
    preparing: "Em preparo",
    delivering: "Saiu para entrega",
    completed: "Concluído",
    canceled: "Cancelado",
  };

  return (
    <SectionShell title="Meus pedidos" onClose={onClose}>
      {error ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">{error}</p>
      ) : orders === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Package size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500">Você ainda não fez pedidos nesta loja.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-400">
                  #{(order.id.split("-")[0] ?? order.id).toUpperCase()}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                  {statusLabel[order.status] ?? order.status}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                {order.order_items
                  ?.map((item) => `${item.quantity}x ${item.product_name}`)
                  .join(", ")}
              </p>
              <p className="mt-1.5 text-base font-black text-slate-900">
                {formatCurrency(order.total_amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function AddressesSection({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [editing, setEditing] = useState<CustomerAddress | "new" | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    getMyAddresses()
      .then(setAddresses)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (open) {
      setEditing(null);
      setError("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  if (editing) {
    return (
      <AddressForm
        address={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={async (data) => {
          await saveMyAddress(data);
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <SectionShell title="Meus endereços" onClose={onClose}>
      {error ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">{error}</p>
      ) : addresses === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    {address.street}, {address.number}
                    {address.is_default && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                        Padrão
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {address.neighborhood}
                    {address.complement ? ` - ${address.complement}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Excluir endereço"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={async () => {
                    await deleteMyAddress(address.id);
                    load();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-3 h-11 w-full font-bold"
            onClick={() => setEditing("new")}
          >
            <Plus size={16} className="mr-1" /> Adicionar endereço
          </Button>
        </>
      )}
    </SectionShell>
  );
}

function AddressForm({
  address,
  onSave,
  onCancel,
}: {
  address: CustomerAddress | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(address?.label ?? "");
  const [neighborhood, setNeighborhood] = useState(address?.neighborhood ?? "");
  const [street, setStreet] = useState(address?.street ?? "");
  const [number, setNumber] = useState(address?.number ?? "");
  const [complement, setComplement] = useState(address?.complement ?? "");
  const [reference, setReference] = useState(address?.reference ?? "");
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);
  const [saving, setSaving] = useState(false);

  return (
    <SectionShell title={address ? "Editar endereço" : "Novo endereço"} onClose={onCancel}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await onSave({
              id: address?.id,
              label,
              neighborhood,
              street,
              number,
              complement,
              reference,
              is_default: isDefault,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="addr-label">Apelido (opcional)</Label>
          <Input
            id="addr-label"
            placeholder="Casa, trabalho…"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-street">Rua</Label>
          <Input
            id="addr-street"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="addr-number">Número</Label>
            <Input
              id="addr-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addr-neighborhood">Bairro</Label>
            <Input
              id="addr-neighborhood"
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-complement">Complemento (opcional)</Label>
          <Input
            id="addr-complement"
            value={complement}
            onChange={(event) => setComplement(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-reference">Referência (opcional)</Label>
          <Input
            id="addr-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Checkbox checked={isDefault} onCheckedChange={(value) => setIsDefault(value === true)} />
          Definir como endereço padrão
        </label>
        <Button type="submit" className="h-11 w-full font-bold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar endereço
        </Button>
      </form>
    </SectionShell>
  );
}

function CouponsSection({
  open,
  storeId,
  formatCurrency,
  onClose,
}: {
  open: boolean;
  storeId: string;
  formatCurrency: (value: number) => string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"available" | "used">("available");
  const [coupons, setCoupons] = useState<MyCoupon[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useMemo(
    () => () => {
      getMyCoupons(storeId)
        .then(setCoupons)
        .catch((err: Error) => setError(err.message));
    },
    [storeId],
  );

  useEffect(() => {
    if (open) {
      setError("");
      setCopied(null);
      load();
    }
  }, [open, load]);

  if (!open) return null;

  const isExpired = (coupon: MyCoupon) =>
    coupon.expires_at !== null && new Date(coupon.expires_at) <= new Date();
  const isUsedUp = (coupon: MyCoupon) => coupon.times_used > 0;

  const visible =
    tab === "available"
      ? (coupons ?? []).filter((coupon) => !isExpired(coupon) && !isUsedUp(coupon))
      : (coupons ?? []).filter((coupon) => isExpired(coupon) || isUsedUp(coupon));

  const discountLabel = (coupon: MyCoupon) =>
    coupon.discount_type === "percent"
      ? `${Number(coupon.discount_value).toFixed(0)}% OFF`
      : `${formatCurrency(Number(coupon.discount_value))} OFF`;

  return (
    <SectionShell title="Cupons e benefícios" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(["available", "used"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              "rounded-lg py-1.5 text-xs font-black uppercase tracking-wide transition-colors " +
              (tab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")
            }
          >
            {value === "available" ? "Disponíveis" : "Utilizados"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">{error}</p>
      ) : coupons === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Ticket size={32} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">
            {tab === "available"
              ? "Você ainda não possui cupons disponíveis."
              : "Nenhum cupom utilizado ainda."}
          </p>
          <p className="text-xs text-slate-400">Os novos cupons aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((coupon) => (
            <div
              key={coupon.coupon_id}
              className={
                "rounded-2xl border p-3.5 shadow-sm " +
                (tab === "used"
                  ? "border-slate-100 bg-slate-50 opacity-75"
                  : "border-slate-100 bg-white")
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-black tracking-wider text-slate-900">
                    {coupon.code}
                  </p>
                  <p className="text-base font-black text-[var(--primary-color)]">
                    {discountLabel(coupon)}
                  </p>
                </div>
                {tab === "available" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1 text-xs font-bold"
                    onClick={async () => {
                      await copyCouponCode(coupon.code);
                      setCopied(coupon.coupon_id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  >
                    {copied === coupon.coupon_id ? (
                      <>
                        <Check size={13} /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copiar
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                {coupon.description && <p>{coupon.description}</p>}
                {Number(coupon.min_order_amount) > 0 && (
                  <p>Pedido mínimo: {formatCurrency(Number(coupon.min_order_amount))}</p>
                )}
                {coupon.expires_at && !isExpired(coupon) && (
                  <p>Válido até: {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}</p>
                )}
                {isExpired(coupon) && <p className="font-bold text-slate-400">Expirado</p>}
                {isUsedUp(coupon) && (
                  <p className="font-bold text-slate-400">
                    Utilizado {coupon.times_used}x
                    {coupon.last_used_at
                      ? ` · ${new Date(coupon.last_used_at).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
          {tab === "available" && (
            <p className="px-1 pt-1 text-center text-xs text-slate-400">
              Informe o código no checkout para aplicar o desconto.
            </p>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function SimpleListSection({
  open,
  title,
  icon: Icon,
  emptyText,
  items,
  onClose,
}: {
  open: boolean;
  title: string;
  icon: any;
  emptyText: string;
  items: { id: string; label: string }[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <SectionShell title={title} onClose={onClose}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3.5 py-3">
              <Icon size={17} className="shrink-0 text-[var(--primary-color)]" />
              <span className="text-sm font-semibold text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function EditProfileDialog({
  open,
  session,
  onSave,
  onClose,
}: {
  open: boolean;
  session: CustomerSession;
  onSave: (name: string, phone: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(session.name);
      setPhone(session.phone);
    }
  }, [open, session]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-[340px] gap-0 rounded-2xl p-5" hideClose>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-black">Editar perfil</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await onSave(name.trim(), phone.trim());
            } catch {
              // erro já sinalizado via toast pelo chamador
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Telefone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full font-bold" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
