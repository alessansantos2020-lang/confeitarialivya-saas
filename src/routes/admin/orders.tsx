import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  beforeLoad: () => {
    throw redirect({ to: "/staff" });
  },
  component: OrdersCompatibilityPage,
});

function OrdersCompatibilityPage() {
  return null;
}
