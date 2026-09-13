import type {
  StoreStatus,
  StoreOverview,
  AssignableUser,
  PlanOverview,
  StoreDetails,
} from "@/lib/super-admin.functions";

export type { StoreStatus, StoreOverview, AssignableUser, PlanOverview, StoreDetails };

export const STATUS_LABEL: Record<StoreStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
  suspended: "Suspensa",
};

export const STATUS_CLASS: Record<StoreStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  inactive: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  suspended: "bg-red-500/15 text-red-400 border-red-500/30",
};
