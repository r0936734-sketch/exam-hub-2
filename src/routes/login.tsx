import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { type CSSProperties, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { loginStudentServerFn } from "@/services/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

type Form = { identifier: string; password: string };

// Telegram paper-plane SVG (lucide does not ship one).
function TelegramIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// Animated floating dot grid for left panel
function DotGrid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

// Left panel stat pill
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3">
      <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
      <span className="text-xs text-white/70 leading-tight max-w-20">{label}</span>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>();

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await loginStudentServerFn({
        data: {
          identifier: data.identifier.trim(),
          password: data.password.trim(),
        },
      });
      signIn(res.user, res.user.role, res.token);
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message || "Invalid name/user ID or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Scoped font import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Lato:wght@400;700&display=swap');
        .lt-login { font-family: 'Lato', sans-serif; }
        .lt-login .display { font-family: 'Sora', sans-serif; }
        @keyframes lt-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes lt-fadein {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lt-animate-1 { animation: lt-fadein 0.5s ease both 0.05s; }
        .lt-animate-2 { animation: lt-fadein 0.5s ease both 0.15s; }
        .lt-animate-3 { animation: lt-fadein 0.5s ease both 0.25s; }
        .lt-animate-4 { animation: lt-fadein 0.5s ease both 0.35s; }
        .lt-animate-5 { animation: lt-fadein 0.5s ease both 0.45s; }
        .lt-float { animation: lt-float 4s ease-in-out infinite; }
        .lt-input {
          height: 44px;
          font-family: 'Lato', sans-serif;
          font-size: 14px;
          border-radius: 10px;
          border: 1.5px solid #f0ece2;
          background: #f8fcf881;
          padding: 0 14px;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          outline: none;
          color: #0f172a;
        }
        .lt-input:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }
        .lt-input::placeholder { color: #94a3b8; }
        .lt-input-wrap { position: relative; }
        .lt-eye-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #94a3b8; padding: 0; display: flex;
          transition: color 0.15s;
        }
        .lt-eye-btn:hover { color: #475569; }
        .lt-submit-btn {
          width: 100%; height: 46px;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #fff;
          font-family: 'Sora', sans-serif;
          font-size: 14px; font-weight: 600;
          border: none; border-radius: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 4px 14px rgba(37,99,235,0.35);
        }
        .lt-submit-btn:hover:not(:disabled) { opacity: 0.93; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37,99,235,0.4); }
        .lt-submit-btn:active:not(:disabled) { transform: translateY(0); }
        .lt-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lt-tg-banner {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, #e8f4fd 0%, #dbeafe 100%);
          border: 1.5px solid #bfdbfe;
          border-radius: 14px;
          padding: 14px 16px;
          text-decoration: none;
          transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .lt-tg-banner:hover {
          border-color: #93c5fd;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(59,130,246,0.15);
        }
        .lt-tg-icon {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lt-admin-btn {
          width: 100%; height: 42px;
          background: transparent;
          color: #64748b;
          font-family: 'Lato', sans-serif;
          font-size: 13px; font-weight: 700;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          text-decoration: none;
        }
        .lt-admin-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #334155; }
      `}</style>

      <div className="lt-login min-h-screen flex bg-white">

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div
          className="hidden lg:flex flex-col justify-between relative overflow-hidden"
          style={{
            width: "44%",
            background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 55%, #1d4ed8 100%)",
            padding: "48px 52px",
          }}
        >
          <DotGrid />

          {/* Decorative circle blobs */}
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-24 size-80 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #60a5fa, transparent 70%)" }}
          />
          <div
            aria-hidden="true"
            className="absolute bottom-20 -left-20 size-64 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)" }}
          />

          {/* Logo */}
          <div className="relative flex items-center gap-3 z-10">
            <div
              className="lt-float"
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* Graduation cap SVG */}
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <div>
              <p className="display text-white font-semibold text-sm leading-tight">UP LT Grade</p>
              <p className="text-white/60 text-xs">Computer Prep Portal</p>
            </div>
          </div>

          {/* Hero copy */}
          <div className="relative z-10">
            <p className="text-blue-300/80 text-xs font-bold uppercase tracking-widest mb-4">
              Mains Preparation
            </p>
            <h1
              className="display text-white font-bold leading-tight"
              style={{ fontSize: "clamp(28px, 3vw, 38px)" }}
            >
              Prepare smarter.<br />
              Score better.<br />
              <span style={{ color: "#60a5fa" }}>Get the seat.</span>
            </h1>
            <p className="mt-5 text-white/60 text-sm leading-relaxed max-w-xs">
              Practice tests, faculty evaluation, and a full Computer syllabus tracker -
              everything you need for UP LT Grade Mains.
            </p>

            {/* Stats row */}
            <div className="mt-8 flex flex-wrap gap-3">
              <StatPill value="682"   label="students enrolled" />
              <StatPill value="1056"  label="total seats" />
              <StatPill value="40%"   label="qualifying cutoff" />
            </div>
          </div>

          {/* Footer */}
          <p className="relative z-10 text-white/30 text-xs">
            © 2026 UP LT Grade Computer Prep
          </p>
        </div>

        {/* ── Right panel — form ──────────────────────────────────────────── */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            padding: "32px 24px",
            background: "linear-gradient(180deg, #ffedfd 0%, #fff3eb62 50%, #fef3c7 100%)",
          }}
        >
          <div style={{ width: "100%", maxWidth: 420 }}>

            {/* Mobile logo */}
            <div className="lt-animate-1 flex items-center gap-2 lg:hidden mb-8">
              <div style={{ width:36, height:36, borderRadius:10, background:"#1d4ed8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <span className="display font-semibold text-slate-800 text-sm">UP LT Grade Prep</span>
            </div>

            {/* Heading */}
            <div className="lt-animate-1">
              <h2 className="display font-bold text-slate-900" style={{ fontSize: 26 }}>
                Welcome back
              </h2>
              <p className="mt-1 text-slate-500 text-sm">
                Sign in to continue your preparation.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="lt-animate-2"
              style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 18 }}
            >
              <div>
                <label
                  htmlFor="identifier"
                  style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}
                >
                  Name or User ID
                </label>
                <input
                  id="identifier"
                  autoComplete="username"
                  placeholder="e.g. Alok Singh"
                  className="lt-input"
                  suppressHydrationWarning
                  {...register("identifier", { required: "Name or user ID is required" })}
                />
                {errors.identifier && (
                  <p style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>
                    {errors.identifier.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 }}
                >
                  Password
                </label>
                <div className="lt-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="abc123"
                    className="lt-input"
                    style={{ paddingRight: 40 }}
                    suppressHydrationWarning
                    {...register("password", { required: "Password is required" })}
                  />
                  <button
                    type="button"
                    className="lt-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    suppressHydrationWarning
                  >
                    {showPassword
                      ? <EyeOff size={16} />
                      : <Eye size={16} />
                    }
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="lt-submit-btn"
                disabled={loading}
                suppressHydrationWarning
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Divider */}
            <div
              className="lt-animate-3"
              style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0", color: "#94a3b8", fontSize: 12 }}
            >
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              New here?
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            </div>

            {/* Telegram CTA */}
            <div className="lt-animate-4">
              <a
                href="https://t.me/upltgradecse"
                target="_blank"
                rel="noopener noreferrer"
                className="lt-tg-banner"
              >
                <div className="lt-tg-icon">
                  <TelegramIcon className="text-white" style={{ width: 18, height: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 2 }}>
                    Join our Telegram group
                  </p>
                  <p style={{ fontSize: 12, color: "#3b82f6", lineHeight: 1.4 }}>
                    Message the admin to get your User&nbsp;ID &amp; password →&nbsp;
                    <span style={{ fontWeight: 700 }}>@upltgradecse</span>
                  </p>
                </div>
                {/* Arrow */}
                <svg viewBox="0 0 20 20" fill="#93c5fd" width="16" height="16" style={{ flexShrink: 0 }}>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/>
                </svg>
              </a>
            </div>

           {/* Admin link */}
<div
  className="lt-animate-5"
  style={{
    marginTop: 16,
    backgroundColor: "#e6f4f3",
    padding: "8px 12px",
    borderRadius: "10px",
    border: "0.1px solid #e7dac70b"
  }}
>
  <Link to="/admin-login" className="lt-admin-btn">
    <ShieldCheck size={15} />
    <b>Admin sign in</b>
  </Link>
</div>

            <p
              className="lt-animate-5"
              style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#94a3b8" }}
            >
              UP LT Grade Mains Computer preparation portal
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
