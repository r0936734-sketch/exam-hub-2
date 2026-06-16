import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Trophy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAIHubLeaderboardFn } from "@/services/aihub.server";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
interface AIHubLeaderboardRow {
  userId: string;
  name: string;
  avgMarks: number;
  submissions: number;
}

/* ─────────────────────────────────────────────────────────
   Animations
───────────────────────────────────────────────────────── */
const css = `
@keyframes _lb-in {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes _bar-grow {
  from { width: 0%; }
}
@keyframes _crown-bob {
  0%,100% { transform:translateY(0) rotate(-6deg); }
  50%      { transform:translateY(-3px) rotate(-6deg); }
}
@keyframes _rank1-pulse {
  0%,100% { box-shadow:0 0 0 0   hsl(var(--primary)/.35); }
  60%      { box-shadow:0 0 0 10px hsl(var(--primary)/0);  }
}
.lb-row-in   { animation: _lb-in .22s ease both; }
.lb-bar      { animation: _bar-grow .7s cubic-bezier(.22,1,.36,1) both; }
.lb-crown    { animation: _crown-bob 2.6s ease-in-out infinite; }
.lb-rank1    { animation: _rank1-pulse 2.8s ease-out infinite; }
`;

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* Deterministic hue from a string — keeps same colour per name across renders */
function nameHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % 360;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/* ─────────────────────────────────────────────────────────
   Podium card — top-3 hero display
───────────────────────────────────────────────────────── */
function PodiumCard({
  row,
  rank,
  maxAvg,
  delay,
}: {
  row: AIHubLeaderboardRow;
  rank: number;
  maxAvg: number;
  delay: number;
}) {
  const hue = nameHue(row.name);
  const isFirst = rank === 0;

  return (
    <div
      className={["lb-row-in flex flex-col items-center gap-1.5 text-center", isFirst ? "order-first sm:order-none" : ""].join(" ")}
      style={{ animationDelay: `${delay}ms`, flex: "1 1 0", minWidth: 0 }}
    >
      {/* Crown above rank-1 */}
      {isFirst && (
        <span className="lb-crown text-xl leading-none" aria-hidden>
          👑
        </span>
      )}
      {!isFirst && <span className="h-7" aria-hidden />}

      {/* Avatar */}
      <div
        className={isFirst ? "lb-rank1" : ""}
        style={{
          width: isFirst ? 60 : 48,
          height: isFirst ? 60 : 48,
          borderRadius: "50%",
          background: `hsl(${hue} 55% 88%)`,
          border: isFirst
            ? `2.5px solid hsl(${hue} 60% 55%)`
            : `1.5px solid hsl(${hue} 40% 78%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: isFirst ? 18 : 14,
          fontWeight: 700,
          color: `hsl(${hue} 55% 30%)`,
          flexShrink: 0,
        }}
      >
        {initials(row.name)}
      </div>

      {/* Medal */}
      <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
        {MEDAL[rank]}
      </span>

      {/* Name */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--foreground)",
          lineHeight: 1.2,
          wordBreak: "break-word",
          maxWidth: 80,
        }}
      >
        {row.name}
      </p>

      {/* Score */}
      <p
        style={{
          fontSize: isFirst ? 22 : 18,
          fontWeight: 700,
          color: `hsl(${hue} 60% ${isFirst ? "40%" : "45%"})`,
          lineHeight: 1,
        }}
      >
        {row.avgMarks.toFixed(1)}
      </p>
      <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: -2 }}>
        avg marks
      </p>

      {/* Mini bar */}
      <div
        style={{
          width: "100%",
          height: 4,
          borderRadius: 99,
          background: `hsl(${hue} 40% 90%)`,
          overflow: "hidden",
          marginTop: 2,
        }}
      >
        <div
          className="lb-bar"
          style={{
            height: "100%",
            width: `${(row.avgMarks / maxAvg) * 100}%`,
            background: `hsl(${hue} 60% 55%)`,
            borderRadius: 99,
            animationDelay: `${delay + 200}ms`,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Rest-of-list row
───────────────────────────────────────────────────────── */
function LeaderRow({
  row,
  rank,
  maxAvg,
  delay,
  isCurrentUser,
}: {
  row: AIHubLeaderboardRow;
  rank: number;
  maxAvg: number;
  delay: number;
  isCurrentUser?: boolean;
}) {
  const hue = nameHue(row.name);
  const pct = Math.round((row.avgMarks / maxAvg) * 100);

  return (
    <div
      className="lb-row-in"
      style={{
        animationDelay: `${delay}ms`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: "var(--radius)",
        border: isCurrentUser
          ? "1.5px solid hsl(var(--primary)/.35)"
          : "0.5px solid hsl(var(--border)/.6)",
        background: isCurrentUser
          ? "hsl(var(--primary)/.06)"
          : "hsl(var(--card)/.5)",
      }}
    >
      {/* Rank number */}
      <span
        style={{
          width: 24,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--muted-foreground)",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {rank + 1}
      </span>

      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: `hsl(${hue} 50% 88%)`,
          border: `1px solid hsl(${hue} 40% 76%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: `hsl(${hue} 55% 32%)`,
          flexShrink: 0,
        }}
      >
        {initials(row.name)}
      </div>

      {/* Name + bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--foreground)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 4,
          }}
        >
          {row.name}
          {isCurrentUser && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 99,
                background: "hsl(var(--primary)/.12)",
                color: "hsl(var(--primary))",
                verticalAlign: "middle",
              }}
            >
              you
            </span>
          )}
        </p>
        <div
          style={{
            height: 4,
            borderRadius: 99,
            background: `hsl(${hue} 30% 90%)`,
            overflow: "hidden",
          }}
        >
          <div
            className="lb-bar"
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `hsl(${hue} 55% 58%)`,
              borderRadius: 99,
              animationDelay: `${delay + 150}ms`,
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>
          {row.avgMarks.toFixed(1)}
        </p>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>
          {row.submissions} sub
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────── */
export function AIHubLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<AIHubLeaderboardRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
            try {
        const result = (await getAIHubLeaderboardFn()) as any;
        if (cancelled) return;
        if (result?.error) { setError(result.error); return; }
        setLeaderboard(result?.leaderboard || []);
      } catch {
        if (!cancelled) setError("Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <style>{css}</style>
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const maxAvg = leaderboard.length ? Math.max(...leaderboard.map((r) => r.avgMarks), 1) : 1;
  const podium = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);
  const totalSubs = leaderboard.reduce((s, r) => s + r.submissions, 0);

  return (
    <>
      <style>{css}</style>

      {/* ── Error ── */}
      {error && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Empty ── */}
      {!error && leaderboard.length === 0 && (
        <div
          className="lb-row-in rounded-xl border border-border/50 bg-card/50 py-14 text-center"
        >
          <Trophy className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No submissions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Be the first to submit and claim the top spot.
          </p>
        </div>
      )}

      {!error && leaderboard.length > 0 && (
        <div className="space-y-5">

          {/* ── Stats strip ── */}
          <div
            className="lb-row-in grid grid-cols-3 gap-3"
            style={{ animationDelay: "0ms" }}
          >
            {[
              { label: "students", value: leaderboard.length },
              { label: "submissions", value: totalSubs },
              { label: "top avg", value: podium[0]?.avgMarks.toFixed(1) ?? "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-border/50 bg-card/60 px-3 py-3 text-center"
              >
                <p className="text-lg font-bold text-foreground leading-none">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Podium (top-3) ── */}
          {podium.length > 0 && (
            <div
              className="lb-row-in rounded-xl border border-border/50 bg-card/40 p-5"
              style={{ animationDelay: "60ms" }}
            >
              {/* reorder visually: 2nd · 1st · 3rd */}
              <div className="flex items-end justify-center gap-4 sm:gap-8">
                {podium.length > 1 && (
                  <PodiumCard row={podium[1]} rank={1} maxAvg={maxAvg} delay={120} />
                )}
                <PodiumCard row={podium[0]} rank={0} maxAvg={maxAvg} delay={80} />
                {podium.length > 2 && (
                  <PodiumCard row={podium[2]} rank={2} maxAvg={maxAvg} delay={160} />
                )}
              </div>
            </div>
          )}

          {/* ── Rest of list ── */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <p
                className="lb-row-in px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                style={{ animationDelay: "200ms" }}
              >
                Rankings
              </p>
              {rest.map((row, i) => (
                <LeaderRow
                  key={row.userId}
                  row={row}
                  rank={i + 3}
                  maxAvg={maxAvg}
                  delay={220 + i * 40}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}