"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Sparkles, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { AIHubMain } from "./aihub-main";
import { getAIHubAccessStatusFn, verifyAIHubPasscodeFn } from "@/services/aihub.server";

const css = `
.hub-shimmer { background-clip: text; -webkit-text-fill-color: transparent; }
.hub-pulse  { animation: _pulse-ring 2.6s ease-out infinite; }
.hub-float  { animation: _float 3.8s ease-in-out infinite; }
.hub-fadeup { animation: _fadeup .3s ease both; }
`;

export function AIHubAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [accessStatus, setAccessStatus] = useState<{ enabled: boolean; requiresPasscode: boolean } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const go = async () => {
      try {
        const d = await getAIHubAccessStatusFn();
        if (d.error) { setError(d.error); return; }
        setAccessStatus({ enabled: d.enabled, requiresPasscode: d.requiresPasscode ?? false });
        if (!d.enabled) setError("This section is available only to selected users.");
      } catch { setError("Failed to check access status"); }
      finally { setChecking(false); }
    };
    if (user) go(); else navigate({ to: "/login" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const d = await verifyAIHubPasscodeFn({ data: { passcode: passcode.trim() } });
      if (d.error) { setError(d.error || "Invalid passcode"); return; }
      if (!d.token) { setError("Passcode verified, but no token returned"); return; }
      sessionStorage.setItem("aihub_token", d.token);
      setVerified(true);
    } catch { setError("Failed to verify passcode"); }
    finally { setLoading(false); }
  };

  if (checking) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <style>{css}</style>
        <div className="flex flex-col items-center gap-3">
          <div className="hub-pulse h-12 w-12 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!accessStatus?.enabled) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <style>{css}</style>
        <div className="mx-auto max-w-sm w-full space-y-6 text-center hub-fadeup">
          <div className="hub-float mx-auto h-16 w-16 rounded-2xl border border-primary/20 bg-primary/8 flex items-center justify-center">
            <LockKeyhole className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Invite-only for now</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              AI Hub is available to selected students. Contact your instructor to request access.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 text-left space-y-2.5">
            {["AI question generation", "Handwritten answer evaluation", "Topic-wise progress tracking", "Syllabus coverage map"].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (verified) return <AIHubMain />;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <style>{css}</style>

      <div className="border-b border-border/50 bg-card/40 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          AI Hub · Secure Entry
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="hub-fadeup w-full max-w-sm space-y-6">

          <div className="flex justify-center">
            <div className="hub-float hub-pulse relative rounded-full h-44 w-44 bg-primary/6 border border-primary/10 flex items-center justify-center">
              <LockKeyhole className="h-10 w-10 text-primary" />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="hub-shimmer text-2xl font-bold tracking-tight sm:text-3xl">AI Study Console</h1>
            <p className="text-sm text-muted-foreground">Enter your passcode to open your workspace</p>
          </div>

          {error && (
            <Alert className="border-destructive/40 bg-destructive/8 py-2.5">
              <AlertDescription className="text-sm text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Enter passcode"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                disabled={loading}
                autoFocus
                className="h-12 pr-11 text-center text-base tracking-[0.35em] font-mono border-border/70 bg-background/80 focus-visible:ring-primary/40 focus-visible:border-primary/60 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                disabled={loading}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                aria-label={showPass ? "Hide passcode" : "Show passcode"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading || !passcode.trim()}
              className="h-12 w-full rounded-xl font-semibold text-sm tracking-wide bg-primary hover:bg-primary/90 transition-all active:scale-[.98]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </span>
              ) : "Unlock AI Hub →"}
            </Button>
          </form>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 leading-snug">🔒 Session token stays in this browser only</div>
            <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 leading-snug">📊 Progress saved only after you submit</div>
          </div>

          <details className="group rounded-xl border border-border/40 bg-card/40">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none">
              <span>What's inside?</span>
              <span className="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2">
              {[
                { icon: "🎯", label: "Generate questions" },
                { icon: "📷", label: "Evaluate answers" },
                { icon: "📈", label: "Track progress" },
                { icon: "📚", label: "Syllabus map" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground"><span>{icon}</span><span>{label}</span></div>
              ))}
            </div>
          </details>

        </div>
      </div>
    </div>
  );
}
