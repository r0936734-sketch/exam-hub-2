"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { AIHubMain } from "./aihub-main";
import { getAIHubAccessStatusFn, verifyAIHubPasscodeFn } from "@/services/aihub.server";

/* ─────────────────────────────────────────────────────────────
   Global styles
───────────────────────────────────────────────────────────── */
const css = `
@keyframes _shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes _pulse-ring {
  0%   { box-shadow: 0 0 0 0   hsl(var(--primary)/.4); }
  70%  { box-shadow: 0 0 0 18px hsl(var(--primary)/0); }
  100% { box-shadow: 0 0 0 0   hsl(var(--primary)/0); }
}
@keyframes _float {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-5px); }
}
@keyframes _fadeup {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
.hub-shimmer {
  background: linear-gradient(90deg,
    hsl(var(--foreground)) 0%,
    hsl(var(--primary)) 45%,
    hsl(var(--foreground)) 90%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: _shimmer 3.2s linear infinite;
}
.hub-pulse  { animation: _pulse-ring 2.6s ease-out infinite; }
.hub-float  { animation: _float 3.8s ease-in-out infinite; }
.hub-fadeup { animation: _fadeup .3s ease both; }
`;

/* ─────────────────────────────────────────────────────────────
   Neural-net canvas — the real "AI doing stuff" visual
   Renders a tiny graph of nodes + pulsing signals on a canvas.
   Completely self-contained; just mount <NeuralCanvas />.
───────────────────────────────────────────────────────────── */
interface Node { x: number; y: number; r: number; phase: number; speed: number }
interface Edge { a: number; b: number; pulses: { t: number; speed: number }[] }

function NeuralCanvas({ size = 180 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    /* Build graph — ring of 8 outer nodes + 1 centre */
    const cx = size / 2, cy = size / 2;
    const outerR = size * 0.36;

    const nodes: Node[] = [
      { x: cx, y: cy, r: 5, phase: 0, speed: 1.2 },   // 0 = centre
    ];
    const COUNT = 8;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
      nodes.push({
        x: cx + Math.cos(a) * outerR,
        y: cy + Math.sin(a) * outerR,
        r: 3,
        phase: (i / COUNT) * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.8,
      });
    }

    /* Edges: every outer node → centre + some cross-links */
    const edges: Edge[] = [];
    for (let i = 1; i <= COUNT; i++) {
      edges.push({ a: i, b: 0, pulses: [] });           // outer → centre
    }
    /* a few neighbour cross-links */
    const crosses = [[1,3],[2,5],[4,7],[6,8],[1,5],[3,7]];
    for (const [a, b] of crosses) {
      edges.push({ a, b, pulses: [] });
    }

    /* Randomly fire new pulses */
    const firePulse = () => {
      const e = edges[Math.floor(Math.random() * edges.length)];
      if (e.pulses.length < 3) {
        e.pulses.push({ t: 0, speed: 0.008 + Math.random() * 0.012 });
      }
    };
    const fireInterval = setInterval(firePulse, 280);

<<<<<<< HEAD
    /* Helpers: build CSS color strings with alpha, and normalize --primary */
    const colorWithAlpha = (base: string, alpha: number) => {
      const a = Number.isFinite(alpha) ? alpha : Number(alpha);
      if (!base) return `hsl(220 60% 50% / ${a})`;
      const b = base.trim();
      // If it's a function like `oklch(...)` or already `hsl(...)`/`rgb(...)`,
      // insert the alpha inside the final parenthesis: `func(... / alpha)`.
      if (b.includes("(") && b.endsWith(")")) {
        return b.replace(/\)\s*$/, ` / ${a})`);
      }
      // For hex or bare values, use CSS Color 4 `/ alpha` syntax where supported.
      if (b.startsWith("#") || b.startsWith("rgb") || b.startsWith("hsl")) {
        return `${b} / ${a}`;
      }
      // Otherwise assume it's the H S% L% triple used by shadcn and wrap in hsl().
      return `hsl(${b} / ${a})`;
    };

    /* Derive theme colours from CSS variables at draw time */
    const getColors = () => {
      const style = getComputedStyle(document.documentElement);
      const raw = style.getPropertyValue("--primary").trim();
      // Normalise base primary value: use as-is if it's a full function or common color
      const primaryBase = raw && (raw.includes("(") || raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl"))
        ? raw
        : raw
        ? `hsl(${raw})`
        : "hsl(220 60% 50%)";
      return {
        primaryBase,
        primary: primaryBase,
        primaryFaint: colorWithAlpha(primaryBase, 0.18),
        primaryMid: colorWithAlpha(primaryBase, 0.55),
      };
    };
=======
    /* Derive theme colours from CSS variables at draw time */
    const getColors = () => {
  const primary = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();

  return {
    primary,
    primaryFaint: primary,
    primaryMid: primary,
  };
};
>>>>>>> d00810bb4ababc29cfd79f61697d5b53c8eacc72

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const c = getColors();
      const t = performance.now() / 1000;

      /* Draw edges */
      for (const e of edges) {
        const na = nodes[e.a], nb = nodes[e.b];
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = c.primaryFaint;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        /* Draw pulses along this edge */
        e.pulses = e.pulses.filter(p => p.t <= 1);
        for (const p of e.pulses) {
          const px = na.x + (nb.x - na.x) * p.t;
          const py = na.y + (nb.y - na.y) * p.t;
          const grad = ctx.createRadialGradient(px, py, 0, px, py, 5);
          grad.addColorStop(0, c.primary);
          grad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          p.t += p.speed;
        }
      }

      /* Draw nodes */
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = 0.5 + 0.5 * Math.sin(t * n.speed + n.phase);

        /* Glow ring */
<<<<<<< HEAD
        const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.5);
        gr.addColorStop(0, colorWithAlpha(c.primaryBase, 0.25 * pulse));
        gr.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();
=======
        const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary")
  .trim();

const gr = ctx.createRadialGradient(
  n.x,
  n.y,
  0,
  n.x,
  n.y,
  n.r * 3.5
);

gr.addColorStop(0, primary);
gr.addColorStop(1, "transparent");

ctx.beginPath();
ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2);
ctx.fillStyle = gr;
ctx.fill();
>>>>>>> d00810bb4ababc29cfd79f61697d5b53c8eacc72

        /* Core dot */
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (i === 0 ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? c.primary : c.primaryMid;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      clearInterval(fireInterval);
      cancelAnimationFrame(raf);
    };
  }, [size]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none" }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export function AIHubAccess() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [accessStatus, setAccessStatus] = useState<{ enabled: boolean; requiresPasscode: boolean } | null>(null);
  const [passcode, setPasscode]     = useState("");
  const [verified, setVerified]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [checking, setChecking]     = useState(true);
  const [showPass, setShowPass]     = useState(false);

  useEffect(() => {
    const go = async () => {
      try {
        const d = await getAIHubAccessStatusFn();
        if (d.error) { setError(d.error); return; }
        setAccessStatus({ enabled: d.enabled, requiresPasscode: d.requiresPasscode ?? false });
        if (!d.enabled) setError("This section is available only to selected users.");
      } catch { setError("Failed to check access status"); }
      finally  { setChecking(false); }
    };
    if (user) go(); else navigate({ to: "/login" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const d = await verifyAIHubPasscodeFn({ data: { passcode: passcode.trim() } });
      if (d.error)  { setError(d.error || "Invalid passcode"); return; }
      if (!d.token) { setError("Passcode verified, but no token returned"); return; }
      sessionStorage.setItem("aihub_token", d.token);
      setVerified(true);
    } catch { setError("Failed to verify passcode"); }
    finally { setLoading(false); }
  };

  /* ── Loading ── */
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

  /* ── Access denied ── */
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

  /* ── Passcode gate ── */
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <style>{css}</style>

      {/* Identity strip */}
      <div className="border-b border-border/50 bg-card/40 backdrop-blur px-4 py-2.5 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          AI Hub · Secure Entry
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="hub-fadeup w-full max-w-sm space-y-6">

          {/* ── NEURAL NET ORB — the real AI visual ── */}
          <div className="flex justify-center">
            <div
              className="hub-float hub-pulse relative"
              style={{ width: 180, height: 180, borderRadius: "50%", background: "hsl(var(--primary)/.05)", border: "1px solid hsl(var(--primary)/.15)" }}
            >
              {/* Animated neural network fills the whole circle */}
              <NeuralCanvas size={180} />

              {/* GIF sits at the exact centre node, z above the canvas */}
              <div
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 52, height: 52,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "2px solid hsl(var(--primary)/.5)",
                  background: "hsl(var(--background))",
                  zIndex: 10,
                  boxShadow: "0 0 0 4px hsl(var(--primary)/.12)",
                }}
              >
                <img
                  src="/ai.gif"
                  alt="AI"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                    (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "flex";
                  }}
                />
                {/* Fallback */}
                <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "hsl(var(--primary)/.1)" }}>
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>

<<<<<<< HEAD
              {/* Live dot removed by request */}
=======
              {/* Live dot */}
              <span
                className="hub-pulse"
                style={{
                  position: "absolute", top: 14, right: 14,
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#22c55e",
                  border: "2px solid hsl(var(--background))",
                  zIndex: 11,
                }}
              />
>>>>>>> d00810bb4ababc29cfd79f61697d5b53c8eacc72
            </div>
          </div>

          {/* Headline */}
          <div className="text-center space-y-1.5">
            <h1 className="hub-shimmer text-2xl font-bold tracking-tight sm:text-3xl">
              AI Study Console
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your passcode to open your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert className="border-destructive/40 bg-destructive/8 py-2.5">
              <AlertDescription className="text-sm text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
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

          {/* Trust signals */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 leading-snug">
              🔒 Session token stays in this browser only
            </div>
            <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 leading-snug">
              📊 Progress saved only after you submit
            </div>
          </div>

          {/* What's inside */}
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
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
          </details>

        </div>
      </div>
    </div>
  );
}