/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  Package,
  MapPin,
  Heart,
  CreditCard,
  Bell,
  Gift,
  Settings,
  LogOut,
  ChevronRight,
  ArrowLeft,
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
  paymentMethodsLabel: string[];
  formatCurrency: (value: number) => string;
  onLogin: () => void;
  onClose: () => void;
  onInternalPageChange: (isInternal: boolean) => void;
};

type Section =
  | null
  | "orders"
  | "addresses"
  | "favorites"
  | "payments"
  | "notifications"
  | "coupons"
  | "settings"
  | "account-switch"
  | "edit"
  | "signout";

const profileSections: Exclude<Section, null>[] = [
  "orders",
  "addresses",
  "favorites",
  "payments",
  "notifications",
  "coupons",
  "settings",
  "account-switch",
  "edit",
  "signout",
];

function sectionFromHash(): Section {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.replace(/^#perfil\/?/, "");
  return profileSections.includes(value as Exclude<Section, null>)
    ? (value as Exclude<Section, null>)
    : null;
}

export function ProfileModal({
  open,
  storeId,
  paymentMethodsLabel,
  formatCurrency,
  onLogin,
  onClose,
  onInternalPageChange,
}: ProfileModalProps) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [section, setSectionState] = useState<Section>(sectionFromHash);

  const setSection = (next: Section) => {
    if (typeof window === "undefined") {
      setSectionState(next);
      return;
    }
    if (next === null) {
      if (window.history.state?.profileView && window.history.state?.profileSection) {
        window.history.back();
      } else {
        setSectionState(null);
        window.history.replaceState(
          { profileView: true, profileSection: null },
          "",
          `${window.location.pathname}${window.location.search}#perfil`,
        );
      }
      return;
    }
    window.history.pushState(
      { profileView: true, profileSection: next },
      "",
      `${window.location.pathname}${window.location.search}#perfil/${next}`,
    );
    setSectionState(next);
  };

  useEffect(
    () =>
      onCustomerAuthChange((value) => {
        setSession(value);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (open) {
      setSectionState(sectionFromHash());
      if (!window.history.state?.profileView) {
        window.history.pushState(
          { profileView: true, profileSection: null },
          "",
          `${window.location.pathname}${window.location.search}#perfil`,
        );
      }
    }
  }, [open]);

  useEffect(() => {
    onInternalPageChange(open && section !== null);
  }, [open, section, onInternalPageChange]);

  useEffect(() => {
    const onPopState = () => {
      if (window.history.state?.profileView) {
        setSectionState(window.history.state.profileSection ?? null);
      } else {
        setSectionState(null);
        onClose();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onClose]);

  const pageTitle: Record<Exclude<Section, null>, string> = {
    orders: "Meus pedidos",
    addresses: "Meus endereços",
    favorites: "Favoritos",
    payments: "Formas de pagamento",
    notifications: "Notificações",
    coupons: "Cupons e benefícios",
    settings: "Configurações",
    "account-switch": "Trocar conta",
    edit: "Editar perfil",
    signout: "Sair da conta",
  };

  const goBack = () => {
    if (section) {
      setSection(null);
    } else if (window.history.state?.profileView) {
      window.history.back();
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const accountRows: { key: Section; icon: any; label: string; hint?: string }[] = [
    { key: "orders", icon: Package, label: "Meus pedidos", hint: "Histórico nesta loja" },
    { key: "addresses", icon: MapPin, label: "Meus endereços", hint: "Entrega rápida" },
    { key: "favorites", icon: Heart, label: "Favoritos", hint: "Seus produtos favoritos" },
    {
      key: "payments",
      icon: CreditCard,
      label: "Formas de pagamento",
      hint: "Disponíveis na loja",
    },
  ];
  const prefRows: { key: Section; icon: any; label: string; hint?: string }[] = [
    { key: "notifications", icon: Bell, label: "Notificações", hint: "Preferências de avisos" },
    { key: "coupons", icon: Gift, label: "Cupons e benefícios", hint: "Ofertas e benefícios" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white pt-[env(safe-area-inset-top)] animate-in slide-in-from-right-2 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={section ? pageTitle[section] : "Perfil"}
    >
      {!section && (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={goBack}
            aria-label="Fechar perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-black text-slate-900">Perfil</h2>
          {session && (
            <button
              type="button"
              onClick={() => setSection("edit")}
              aria-label="Editar perfil"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <Pencil size={17} />
            </button>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {!authReady ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !session ? (
          <SignedOutView onLogin={onLogin} />
        ) : section ? (
          <ProfileSubpage
            section={section}
            session={session}
            storeId={storeId}
            paymentMethodsLabel={paymentMethodsLabel}
            formatCurrency={formatCurrency}
            onBack={goBack}
            onLogin={onLogin}
            onSessionUpdate={setSession}
            onSignOut={async () => {
              await signOutCustomer();
              setSectionState(null);
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
              onClose();
            }}
          />
        ) : (
          <SignedInView
            session={session}
            accountRows={accountRows}
            prefRows={prefRows}
            setSection={setSection}
          />
        )}
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
      <Button className="h-11 w-full max-w-sm font-bold" onClick={onLogin}>
        Entrar ou criar conta
      </Button>
    </div>
  );
}

function SignedInView({
  session,
  accountRows,
  prefRows,
  setSection,
}: {
  session: CustomerSession;
  accountRows: { key: Section; icon: any; label: string; hint?: string }[];
  prefRows: { key: Section; icon: any; label: string; hint?: string }[];
  setSection: (section: Section) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl pb-5">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-black text-slate-500">
          {session.avatarUrl ? (
            <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (session.name[0] ?? "?").toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{session.name}</p>
          <p className="truncate text-sm text-slate-500">{session.email || session.phone}</p>
          {session.email && session.phone && (
            <p className="truncate text-xs text-slate-400">{session.phone}</p>
          )}
        </div>
        <Button
          variant="outline"
          className="h-10 gap-1.5 rounded-full px-3 text-xs font-bold"
          onClick={() => setSection("edit")}
        >
          <Pencil size={14} /> Editar
        </Button>
      </div>

      <SectionHeading>Minha conta</SectionHeading>
      <NavRows rows={accountRows} setSection={setSection} />

      <SectionHeading>Preferências</SectionHeading>
      <NavRows rows={prefRows} setSection={setSection} />

      <SectionHeading>Conta</SectionHeading>
      <div className="mx-4 mb-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
        <NavRow
          icon={UserRound}
          label="Trocar conta"
          hint="Alternar entre contas"
          onClick={() => setSection("account-switch")}
        />
        <NavRow
          icon={Settings}
          label="Configurações"
          hint="Dados da conta e privacidade"
          onClick={() => setSection("settings")}
        />
        <NavRow
          icon={LogOut}
          label="Sair"
          hint="Sair da conta"
          onClick={() => setSection("signout")}
          danger
        />
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-5 pb-2 pt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
      {children}
    </h3>
  );
}

function NavRows({
  rows,
  setSection,
}: {
  rows: { key: Section; icon: any; label: string; hint?: string }[];
  setSection: (section: Section) => void;
}) {
  return (
    <div className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
      {rows.map((row) => (
        <NavRow
          key={row.label}
          icon={row.icon}
          label={row.label}
          hint={row.hint}
          onClick={() => setSection(row.key)}
        />
      ))}
    </div>
  );
}

function NavRow({
  icon: Icon,
  label,
  hint,
  onClick,
  danger = false,
}: {
  icon: any;
  label: string;
  hint?: string | undefined;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <Icon
        size={19}
        className={"shrink-0 " + (danger ? "text-red-500" : "text-[var(--primary-color)]")}
      />
      <span className="min-w-0 flex-1">
        <span className={"block text-sm font-bold " + (danger ? "text-red-600" : "text-slate-800")}>
          {label}
        </span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
}

function FullScreenPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-full animate-in slide-in-from-right-2 duration-200">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-slate-100 bg-white/95 px-4 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft size={19} />
        </button>
        <h3 className="text-base font-black text-slate-900">{title}</h3>
      </header>
      <div className="mx-auto w-full max-w-xl p-4">{children}</div>
    </section>
  );
}

function ProfileSubpage({
  section,
  session,
  storeId,
  paymentMethodsLabel,
  formatCurrency,
  onBack,
  onLogin,
  onSessionUpdate,
  onSignOut,
}: {
  section: Exclude<Section, null>;
  session: CustomerSession;
  storeId: string;
  paymentMethodsLabel: string[];
  formatCurrency: (value: number) => string;
  onBack: () => void;
  onLogin: () => void;
  onSessionUpdate: (session: CustomerSession) => void;
  onSignOut: () => Promise<void>;
}) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (section === "orders")
    return (
      <OrdersSection open storeId={storeId} formatCurrency={formatCurrency} onClose={onBack} />
    );
  if (section === "addresses") return <AddressesSection open onClose={onBack} />;
  if (section === "coupons")
    return (
      <CouponsSection open storeId={storeId} formatCurrency={formatCurrency} onClose={onBack} />
    );
  if (section === "payments") {
    return (
      <SimpleListSection
        open
        title="Formas de pagamento"
        icon={CreditCard}
        emptyText="A loja ainda não configurou formas de pagamento."
        items={paymentMethodsLabel.map((label) => ({ id: label, label }))}
        onClose={onBack}
      />
    );
  }
  if (section === "favorites") {
    return (
      <SimpleListSection
        open
        title="Favoritos"
        icon={Heart}
        emptyText="Você ainda não adicionou produtos aos favoritos."
        items={[]}
        onClose={onBack}
      />
    );
  }
  if (section === "notifications") {
    return (
      <SimpleListSection
        open
        title="Notificações"
        icon={Bell}
        emptyText="As preferências de notificações ainda não estão disponíveis."
        items={[]}
        onClose={onBack}
      />
    );
  }
  if (section === "settings") {
    return (
      <SimpleListSection
        open
        title="Configurações"
        icon={Settings}
        emptyText="As configurações da conta ficam disponíveis ao editar seu perfil."
        items={[]}
        onClose={onBack}
      />
    );
  }
  if (section === "edit") {
    return (
      <EditProfilePage
        session={session}
        onClose={onBack}
        onSave={async (name, phone) => {
          await updateCustomerProfile({ name, phone });
          onSessionUpdate({ ...session, name, phone });
          onBack();
        }}
      />
    );
  }
  if (section === "account-switch") {
    return (
      <AccountSwitchPage
        session={session}
        onClose={onBack}
        onSwitch={async () => {
          await onSignOut();
          onLogin();
        }}
      />
    );
  }
  if (section === "signout") {
    return (
      <FullScreenPage title="Sair da conta" onBack={onBack}>
        {!confirmSignOut ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Deseja encerrar a sessão de <strong>{session.email}</strong>?
            </p>
            <Button
              className="h-11 w-full bg-red-600 font-bold text-white hover:bg-red-700"
              onClick={() => setConfirmSignOut(true)}
            >
              Sair da conta
            </Button>
          </div>
        ) : (
          <ConfirmSignOut onCancel={() => setConfirmSignOut(false)} onConfirm={onSignOut} />
        )}
      </FullScreenPage>
    );
  }
  return null;
}

function ConfirmSignOut({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="space-y-4 py-4">
      <p className="text-sm font-semibold text-slate-700">Sair da conta?</p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          className="h-11 flex-1 bg-red-600 text-white hover:bg-red-700"
          onClick={() => void onConfirm()}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}

function AccountSwitchPage({
  session,
  onClose,
  onSwitch,
}: {
  session: CustomerSession;
  onClose: () => void;
  onSwitch: () => Promise<void>;
}) {
  const [switching, setSwitching] = useState(false);
  return (
    <FullScreenPage title="Trocar conta" onBack={onClose}>
      <div className="space-y-4 py-2">
        <p className="text-sm text-slate-600">
          Para usar outra conta, encerre a sessão atual e entre com outro e-mail.
        </p>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-black text-slate-500">
            {(session.name[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{session.name}</p>
            <p className="truncate text-sm text-slate-500">{session.email}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Check size={14} /> Atual
          </span>
        </div>
        <Button
          className="h-11 w-full font-bold"
          disabled={switching}
          onClick={async () => {
            setSwitching(true);
            try {
              await onSwitch();
            } finally {
              setSwitching(false);
            }
          }}
        >
          {switching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar com outra conta
        </Button>
      </div>
    </FullScreenPage>
  );
}

function EditProfilePage({
  session,
  onSave,
  onClose,
}: {
  session: CustomerSession;
  onSave: (name: string, phone: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [phone, setPhone] = useState(session.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <FullScreenPage title="Editar perfil" onBack={onClose}>
      <form
        className="space-y-4 py-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (name.trim().length < 2) {
            setError("Informe seu nome.");
            return;
          }
          if (phone.replace(/\D/g, "").length < 10) {
            setError("Informe um telefone válido.");
            return;
          }
          setSaving(true);
          setError("");
          try {
            await onSave(name.trim(), phone.trim());
            setSaved(true);
          } catch {
            setError("Não foi possível salvar as alterações.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex flex-col items-center gap-3 py-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-black text-slate-500">
            {session.avatarUrl ? (
              <img src={session.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              (name[0] ?? "?").toUpperCase()
            )}
          </div>
          <p className="text-xs text-slate-500">Avatar vinculado à conta</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Nome</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Telefone</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input id="profile-email" type="email" value={session.email} readOnly disabled />
          <p className="text-xs text-slate-400">
            Para alterar o e-mail, entre em contato com o suporte da conta.
          </p>
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {saved && <p className="text-sm font-semibold text-emerald-600">Perfil atualizado.</p>}
        <Button type="submit" className="h-11 w-full font-bold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar alterações
        </Button>
      </form>
    </FullScreenPage>
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
  const [filter, setFilter] = useState<"all" | "active" | "done" | "canceled">("all");
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
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
  const filteredOrders = (orders ?? []).filter((order) => {
    if (filter === "active") return !["completed", "canceled"].includes(order.status);
    if (filter === "done") return order.status === "completed";
    if (filter === "canceled") return order.status === "canceled";
    return true;
  });
  if (selectedOrder) {
    return (
      <FullScreenPage
        title={`Pedido #${selectedOrder.id.slice(0, 8).toUpperCase()}`}
        onBack={() => setSelectedOrder(null)}
      >
        <div className="space-y-3 p-4">
          <p className="font-bold text-slate-800">
            {statusLabel[selectedOrder.status] ?? selectedOrder.status}
          </p>
          <p className="text-sm text-slate-500">
            {selectedOrder.created_at
              ? new Date(selectedOrder.created_at).toLocaleString("pt-BR")
              : ""}
          </p>
          {(selectedOrder.order_items ?? []).map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"
            >
              <span>
                {item.quantity}× {item.product_name}
              </span>
            </div>
          ))}
          <p className="pt-2 text-lg font-black">{formatCurrency(selectedOrder.total_amount)}</p>
        </div>
      </FullScreenPage>
    );
  }
  return (
    <FullScreenPage title="Meus pedidos" onBack={onClose}>
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
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "active", "done", "canceled"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={
                  "shrink-0 rounded-full px-3 py-2 text-xs font-bold " +
                  (filter === value
                    ? "bg-[var(--primary-color)] text-white"
                    : "bg-slate-100 text-slate-600")
                }
              >
                {
                  {
                    all: "Todos",
                    active: "Em andamento",
                    done: "Concluídos",
                    canceled: "Cancelados",
                  }[value]
                }
              </button>
            ))}
          </div>
          {filteredOrders.map((order) => (
            <button
              type="button"
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="w-full rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm"
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
            </button>
          ))}
        </div>
      )}
    </FullScreenPage>
  );
}

function AddressesSection({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [editing, setEditing] = useState<CustomerAddress | "new" | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    getMyAddresses()
      .then(setAddresses)
      .catch((err: Error) => setError(err.message));
  useEffect(() => {
    if (open) {
      setEditing(null);
      setError("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  if (editing)
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
  return (
    <FullScreenPage title="Meus endereços" onBack={onClose}>
      {error ? (
        <p className="px-1 py-6 text-center text-sm text-slate-500">{error}</p>
      ) : addresses === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {addresses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MapPin size={32} className="text-slate-300" />
              <p className="text-sm text-slate-500">Você ainda não cadastrou endereços.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3.5"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setEditing(address)}
                  >
                    <p className="text-sm font-bold text-slate-800">
                      {address.label || `${address.street}, ${address.number}`}{" "}
                      {address.is_default && (
                        <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          Padrão
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {address.street}, {address.number} · {address.neighborhood}
                      {address.complement ? ` - ${address.complement}` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Excluir endereço"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                    onClick={async () => {
                      if (window.confirm("Excluir este endereço?")) {
                        await deleteMyAddress(address.id);
                        load();
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            className="mt-3 h-11 w-full font-bold"
            onClick={() => setEditing("new")}
          >
            <Plus size={16} className="mr-1" /> Adicionar endereço
          </Button>
        </>
      )}
    </FullScreenPage>
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
    <FullScreenPage title={address ? "Editar endereço" : "Novo endereço"} onBack={onCancel}>
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
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar endereço
        </Button>
      </form>
    </FullScreenPage>
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
  const [tab, setTab] = useState<"available" | "used" | "expired">("available");
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
  const visible = (coupons ?? []).filter((coupon) =>
    tab === "available"
      ? !isExpired(coupon) && !isUsedUp(coupon)
      : tab === "expired"
        ? isExpired(coupon)
        : !isExpired(coupon) && isUsedUp(coupon),
  );
  const discountLabel = (coupon: MyCoupon) =>
    coupon.discount_type === "percent"
      ? `${Number(coupon.discount_value).toFixed(0)}% OFF`
      : `${formatCurrency(Number(coupon.discount_value))} OFF`;
  return (
    <FullScreenPage title="Cupons e benefícios" onBack={onClose}>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {(["available", "used", "expired"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              "rounded-lg py-2 text-[10px] font-black uppercase tracking-wide transition-colors " +
              (tab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")
            }
          >
            {{ available: "Disponíveis", used: "Utilizados", expired: "Expirados" }[value]}
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
              : tab === "expired"
                ? "Você não possui cupons expirados."
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
                (tab !== "available"
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
                {coupon.expires_at && (
                  <p>
                    {isExpired(coupon) ? "Expirado em: " : "Válido até: "}
                    {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {isUsedUp(coupon) && (
                  <p className="font-bold text-slate-400">Utilizado {coupon.times_used}x</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </FullScreenPage>
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
    <FullScreenPage title={title} onBack={onClose}>
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
    </FullScreenPage>
  );
}

function ConfirmSignOutDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="max-w-[320px] gap-0 rounded-2xl p-5">
        <DialogTitle className="text-lg font-black">Sair da conta?</DialogTitle>
        <p className="mt-1 text-sm text-slate-500">Você poderá entrar novamente quando quiser.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="h-10 flex-1 font-bold" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            className="h-10 flex-1 bg-red-600 font-bold text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
