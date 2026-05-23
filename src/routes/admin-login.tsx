import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { loginAdminServerFn } from "@/services/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({ component: AdminLogin });

type Form = { userId: string; password: string };

function AdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>();

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await loginAdminServerFn({
        data: { userId: data.userId.trim().toUpperCase(), password: data.password.trim() },
      });
      signIn(res.user, res.user.role, res.token);
      toast.success("Welcome, administrator");
      navigate({ to: "/admin/dashboard" });
    } catch (error) {
      toast.error((error as Error).message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60">
        <CardContent className="p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="size-3" /> Back to student login
          </Link>
          <div className="size-11 rounded-lg bg-accent text-accent-foreground grid place-items-center mb-4">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">LT Grade Prep admin access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restricted area for UP LT Grade Computer faculty and admins.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="aid">Admin ID</Label>
              <Input
                id="aid"
                autoComplete="username"
                placeholder="Admin1010"
                {...register("userId", { required: "Required" })}
              />
              {errors.userId && (
                <p className="mt-1 text-xs text-destructive">{errors.userId.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="apw">Password</Label>
              <Input
                id="apw"
                type="password"
                placeholder="abc123"
                {...register("password", { required: "Required" })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Verifying...
                </>
              ) : (
                "Sign in as admin"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
