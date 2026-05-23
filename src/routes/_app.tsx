import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { getCurrentSessionServerFn } from "@/services/auth.functions";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const session = await getCurrentSessionServerFn();

    if (!session.user) {
      throw redirect({ to: "/login" });
    }

    if (location.pathname.startsWith("/admin") && session.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }

    if (!location.pathname.startsWith("/admin") && session.role === "admin") {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AppLayout,
});
