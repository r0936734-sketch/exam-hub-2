import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { AIHubMain } from "./aihub-main";
import { AIHubGuide } from "./aihub-guide";
import {
  getAIHubAccessStatusFn,
  verifyAIHubPasscodeFn,
} from "@/services/aihub.server";

export function AIHubAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accessStatus, setAccessStatus] = useState<{
    enabled: boolean;
    requiresPasscode: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [showPasscode, setShowPasscode] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const data = await getAIHubAccessStatusFn();
        if (data.error) {
          setError(data.error);
          setCheckingAccess(false);
          return;
        }

        setAccessStatus({
          enabled: data.enabled,
          requiresPasscode: data.requiresPasscode ?? false,
        });

        if (!data.enabled) {
          setError("This section is available only to selected users.");
        }
      } catch (err) {
        setError("Failed to check access status");
      } finally {
        setCheckingAccess(false);
      }
    };

    if (user) {
      checkAccess();
    } else {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const trimmedPasscode = passcode.trim();
      const data = await verifyAIHubPasscodeFn({
        data: { passcode: trimmedPasscode },
      });

      if (data.error) {
        setError(data.error || "Invalid passcode");
        return;
      }

      if (!data.token) {
        setError("Passcode verified, but no access token was returned");
        return;
      }

      sessionStorage.setItem("aihub_token", data.token);
      setVerified(true);
    } catch (err) {
      setError("Failed to verify passcode");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="ai-hub-container flex min-h-[60vh] items-center justify-center px-4">
        <div className="ai-hub-panel rounded-xl px-6 py-5 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">Checking AI Hub access...</p>
        </div>
      </div>
    );
  }

  if (!accessStatus?.enabled) {
    return (
      <div className="ai-hub-container mx-auto max-w-5xl px-4 pb-10">
        <section className="ai-hub-hero mb-6 rounded-xl p-5 sm:p-7">
          <p className="ai-hub-kicker">
            <LockKeyhole className="h-4 w-4" />
            AI Hub access
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            AI hub is currently locked for you now.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            AI Hub gives selected students question generation, handwritten answer evaluation, model answers, and progress tracking in one protected workspace.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            <span className="ai-hub-pill">
              <Sparkles className="h-3.5 w-3.5" />
              Exam practice AI
            </span>
            <span className="ai-hub-pill">
              <ShieldCheck className="h-3.5 w-3.5" />
              Limited access
            </span>
          </div>
        </section>

        <AIHubGuide mode="locked" />
      </div>
    );
  }

  if (verified) {
    return <AIHubMain />;
  }

  return (
    <div className="ai-hub-container mx-auto max-w-5xl px-4 pb-10">
      <section className="ai-hub-hero mb-6 rounded-xl p-5 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ai-hub-kicker">
              <Sparkles className="h-4 w-4" />
              AI Hub secure entry
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Unlock your AI preparation console.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Enter your personal passcode to open question generation, answer evaluation, progress, and syllabus intelligence.
            </p>
          </div>
          <div className="ai-hub-pill w-fit text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            Browser session protected
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[0.82fr_1fr] md:items-stretch">
        <AIHubGuide mode="gate" />

        <Card className="ai-hub-panel ai-guide-card rounded-xl p-5 sm:p-6">
          <div className="mb-5">
            <p className="ai-hub-kicker">
              <KeyRound className="h-4 w-4" />
              Passcode required
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">AI Hub Access</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter your personal passcode to start a protected AI Hub session.
            </p>
          </div>

          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
              <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleVerifyPasscode}>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Access key
              </label>
              <div className="relative">
                <Input
                  type={showPasscode ? "text" : "password"}
                  placeholder="Enter passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  disabled={loading}
                  className="h-12 border-primary/25 bg-background/80 pr-10 text-center text-base tracking-widest focus-visible:ring-primary sm:text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                  disabled={loading}
                >
                  {showPasscode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !passcode}
              className="ai-hub-primary-button ai-guide-unlock-button h-12 w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Unlock AI Hub"
              )}
            </Button>
          </form>

          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/55 p-3">
              Session token stays in this browser session.
            </div>
            <div className="rounded-md border border-border bg-background/55 p-3">
              Evaluation data is saved only after you submit an answer.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
