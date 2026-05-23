import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

// Protected layout. Reads auth from localStorage at navigation time.
// Replace with proper server-side auth verification when wiring real backend.
export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("exampro.auth");
    const auth = raw ? JSON.parse(raw) : null;
    if (!auth?.user) {
      throw redirect({ to: "/login" });
    }
    if (location.pathname.startsWith("/admin") && auth.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AppLayout,
});
