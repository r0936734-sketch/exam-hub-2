import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { getCurrentSessionServerFn } from "@/services/auth.functions";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    // Get fresh session from server to ensure we have the latest state
    const session = await getCurrentSessionServerFn();

    if (!session.user) {
      throw redirect({ to: "/login", replace: true });
    }

    // Prevent admins from accessing student routes and vice versa
    if (location.pathname.startsWith("/admin") && session.role !== "admin") {
      throw redirect({ to: "/dashboard", replace: true });
    }

    if (!location.pathname.startsWith("/admin") && session.role === "admin") {
      throw redirect({ to: "/admin/dashboard", replace: true });
    }
  },
  component: AppLayout,
});
