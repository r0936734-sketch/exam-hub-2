import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { loginServerFn } from "@/server/auth.server";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Form = { userId: string; password: string };

function LoginPage() {
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
      const res = await loginServerFn(data);
      signIn(res.user, res.user.role, res.token);
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error("Invalid user ID or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-white/15 grid place-items-center backdrop-blur">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-semibold">ExamPro</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Prepare. Submit.
            <br />
            Outperform.
          </h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            A complete platform for exam practice, answer submission and faculty-led evaluation —
            built for serious students.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">© 2024 ExamPro Learning Platform</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md border-border/60 shadow-sm">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 lg:hidden mb-8">
              <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                <GraduationCap className="size-5" />
              </div>
              <span className="font-semibold">ExamPro</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in to your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your student credentials to continue.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  autoComplete="username"
                  placeholder="STU2024001"
                  {...register("userId", {
                    required: "User ID is required",
                    minLength: { value: 3, message: "Min 3 characters" },
                  })}
                />
                {errors.userId && (
                  <p className="mt-1 text-xs text-destructive">{errors.userId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password", {
                    required: "Password is required",
                    minLength: { value: 4, message: "Min 4 characters" },
                  })}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
            </div>

            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/admin-login">
                <ShieldCheck className="size-4" /> Admin sign in
              </Link>
            </Button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Tip: any non-empty credentials work for this demo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
