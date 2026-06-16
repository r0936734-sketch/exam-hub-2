import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionGenerator } from "./question-generator";
import { ProgressDashboard } from "./progress-dashboard";
import { SyllabusManager } from "./syllabus-manager";
import { AIHubLeaderboard } from "./aihub-leaderboard";
import {
  BarChart3,
  BookOpen,
  Lightbulb,
  Trophy,
  Sparkles,
  Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Animations
───────────────────────────────────────────────────────────── */
const styles = `
@keyframes aihub-breathe {
  0%,100% { opacity:.75; transform:scale(1); }
  50%      { opacity:1;   transform:scale(1.07); }
}
@keyframes aihub-slide-up {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes aihub-status-blink {
  0%,100% { opacity:1; }
  50%      { opacity:.25; }
}
@keyframes aihub-thinking-ring {
  0%   { box-shadow:0 0 0 0   hsl(var(--primary)/.5); }
  70%  { box-shadow:0 0 0 10px hsl(var(--primary)/0); }
  100% { box-shadow:0 0 0 0   hsl(var(--primary)/0); }
}
@keyframes aihub-thinking-spin {
  0%   { transform:rotate(0deg);   opacity:1; }
  50%  { transform:rotate(180deg); opacity:.6; }
  100% { transform:rotate(360deg); opacity:1; }
}
@keyframes aihub-orb-rotate {
  from { transform:rotate(0deg); }
  to   { transform:rotate(360deg); }
}

.aihub-breathe       { animation: aihub-breathe 3.2s ease-in-out infinite; }
.aihub-slide-up      { animation: aihub-slide-up .22s ease both; }
.aihub-status-dot    { animation: aihub-status-blink 2s ease-in-out infinite; }
.aihub-thinking-ring { animation: aihub-thinking-ring 1.6s ease-out infinite; }
.aihub-thinking-spin { animation: aihub-thinking-spin 2.4s linear infinite; }
.aihub-orb-rotate    { animation: aihub-orb-rotate 8s linear infinite; }

/* Desktop sidebar layout */
.aihub-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
@media (min-width: 1024px) {
  .aihub-shell {
    flex-direction: row;
    align-items: stretch;
  }
  .aihub-sidebar {
    display: flex !important;
    position: sticky;
    top: 0;
    height: 100dvh;
    width: 220px;
    min-width: 220px;
    flex-direction: column;
    border-right: 1px solid hsl(var(--border)/.6);
    background: hsl(var(--card)/.6);
    backdrop-filter: blur(12px);
    padding: 0;
    overflow: hidden;
  }
  .aihub-main-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .aihub-mobile-header { display: none !important; }
  .aihub-mobile-tabs   { display: none !important; }
  .aihub-content-wrap  {
    max-width: 900px;
    margin: 0 auto;
    padding: 28px 32px;
    width: 100%;
  }
}
@media (max-width: 1023px) {
  .aihub-sidebar { display: none; }
  .aihub-content-wrap { padding: 16px; }
}
`;

const hubTabs = [
  {
    value: "questions",
    label: "Practice",
    fullLabel: "Generate & Evaluate",
    description: "Create exam questions and check handwritten answers.",
    icon: Lightbulb,
    emoji: "🎯",
  },
  {
    value: "progress",
    label: "Progress",
    fullLabel: "Progress",
    description: "Track scores, attempts, and weak areas.",
    icon: BarChart3,
    emoji: "📈",
  },
  {
    value: "leaderboard",
    label: "Ranks",
    fullLabel: "Leaderboard",
    description: "Compare AI Hub average marks and submissions.",
    icon: Trophy,
    emoji: "🏆",
  },
  {
    value: "syllabus",
    label: "Syllabus",
    fullLabel: "Syllabus",
    description: "See unit coverage and topic mastery.",
    icon: BookOpen,
    emoji: "📚",
  },
] as const;

type TabValue = (typeof hubTabs)[number]["value"];

/* ─────────────────────────────────────────────────────────────
   AI Thinking Orb — shown when AI is actively generating
   Pass `active={true}` while waiting for a server response.
   The parent (QuestionGenerator / AnswerEvaluator) can lift
   this state up through a context; for now it pulses whenever
   the "questions" tab is active as a visual signal.
───────────────────────────────────────────────────────────── */
function AIThinkingOrb({ active }: { active: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center"
      title={active ? "AI is generating…" : "AI ready"}
    >
      {/* Rotating outer ring — only when active */}
      {active && (
        <svg
          className="aihub-orb-rotate absolute"
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden
        >
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      )}

      {/* The GIF itself */}
      <div
        className={[
          "relative z-10 overflow-hidden rounded-xl",
          active ? "aihub-thinking-ring" : "",
        ].join(" ")}
        style={{ width: 36, height: 36 }}
      >
        <img
          src="/ai2.gif"
          alt={active ? "AI generating" : "AI ready"}
          className={[
            "h-full w-full object-cover transition-all duration-500",
            active ? "opacity-100 scale-110" : "opacity-50 scale-100 grayscale",
          ].join(" ")}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
            (el.nextElementSibling as HTMLElement)!.style.display = "flex";
          }}
        />
        {/* Fallback */}
        <div
          className="hidden h-full w-full items-center justify-center bg-primary/10 rounded-xl"
          aria-hidden
        >
          <Zap
            className={["h-5 w-5 text-primary transition-all", active ? "aihub-thinking-spin" : "opacity-40"].join(" ")}
          />
        </div>
      </div>

      {/* Status label below orb */}
      <span
        className={[
          "absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tracking-widest uppercase transition-all",
          active ? "text-primary opacity-100" : "text-muted-foreground opacity-60",
        ].join(" ")}
      >
        {active ? "Thinking…" : "Ready"}
      </span>
    </div>
  );
}

export function AIHubMain() {
  const [activeTab, setActiveTab] = useState<TabValue>("questions");
  // In a real integration, wire this to your generateQuestionFn / evaluateAnswerFn loading states
  const [aiThinking] = useState(false);
  const subject = "Computer Science";
  const activeTabMeta = hubTabs.find((t) => t.value === activeTab) ?? hubTabs[0];

  return (
    <div className="aihub-shell">
      <style>{styles}</style>

      {/* ═══════════════════════════════════════════════════
          DESKTOP SIDEBAR  (hidden on mobile via CSS)
      ═══════════════════════════════════════════════════ */}
      <aside className="aihub-sidebar">
        {/* Brand strip */}
        <div className="border-b border-border/50 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <img
                src="/ai.gif"
                alt="AI Hub active"
                className="aihub-breathe h-8 w-8 rounded-lg object-cover ring-1 ring-primary/30"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  (el.nextElementSibling as HTMLElement)!.style.display = "flex";
                }}
              />
              <div className="hidden h-8 w-8 rounded-lg bg-primary/10 items-center justify-center ring-1 ring-primary/30">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="aihub-status-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
                AI Hub
              </p>
              <p className="text-[13px] font-bold text-foreground leading-tight">{subject}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {hubTabs.map((tab) => {
            const isActive = tab.value === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={[
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-primary/12 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent",
                ].join(" ")}
              >
                <span className="text-base leading-none">{tab.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-none">{tab.label}</p>
                  <p className="mt-0.5 text-[11px] opacity-70 leading-snug truncate">{tab.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* AI Orb — bottom of sidebar, meaningful status */}
        <div className="border-t border-border/50 px-4 py-5 flex flex-col items-center gap-1">
          <AIThinkingOrb active={aiThinking} />
          <div style={{ marginTop: 24 }} className="text-center">
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              Session protected
            </p>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════
          MAIN COLUMN
      ═══════════════════════════════════════════════════ */}
      <div className="aihub-main-col">

        {/* ── Mobile-only top header ── */}
        <header className="aihub-mobile-header sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <img
                  src="/ai.gif"
                  alt="AI active"
                  className="aihub-breathe h-7 w-7 rounded-lg object-cover ring-1 ring-primary/30"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    el.style.display = "none";
                    (el.nextElementSibling as HTMLElement)!.style.display = "flex";
                  }}
                />
                <div className="hidden h-7 w-7 rounded-lg bg-primary/10 items-center justify-center ring-1 ring-primary/30">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="aihub-status-dot absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-background" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">AI Hub</p>
                <p className="text-[13px] font-bold text-foreground">{subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1">
              <activeTabMeta.icon className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium">{activeTabMeta.label}</span>
            </div>
          </div>

          {/* Mobile tab bar */}
          <div className="aihub-mobile-tabs border-t border-border/40 bg-background/70">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <TabsList className="h-auto w-full gap-0 rounded-none bg-transparent p-0 grid grid-cols-4">
                {hubTabs.map((tab) => {
                  const isActive = tab.value === activeTab;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={[
                        "flex h-10 flex-col items-center justify-center gap-0.5 rounded-none border-b-2 px-2 py-0 text-[11px] font-semibold transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground",
                      ].join(" ")}
                    >
                      <span className="text-sm leading-none">{tab.emoji}</span>
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1">
          <div className="aihub-content-wrap">
            {/* Section header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 text-lg shrink-0">
                  {activeTabMeta.emoji}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground leading-tight">
                    {activeTabMeta.fullLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeTabMeta.description}
                  </p>
                </div>
              </div>

              {/* AI Orb — mobile/top-right, visible on all screen sizes in content area */}
              {activeTab === "questions" && (
                <div className="shrink-0 mt-1">
                  <AIThinkingOrb active={aiThinking} />
                </div>
              )}
            </div>

            {/* Tab panels */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <div className="aihub-slide-up" key={activeTab}>
                <TabsContent value="questions" className="mt-0 space-y-4" forceMount={activeTab === "questions" ? true : undefined}>
                  <QuestionGenerator subject={subject} />
                </TabsContent>

                <TabsContent value="progress" className="mt-0 space-y-4" forceMount={activeTab === "progress" ? true : undefined}>
                  <ProgressDashboard subject={subject} />
                </TabsContent>

                <TabsContent value="leaderboard" className="mt-0 space-y-4" forceMount={activeTab === "leaderboard" ? true : undefined}>
                  <AIHubLeaderboard />
                </TabsContent>

                <TabsContent value="syllabus" className="mt-0 space-y-4" forceMount={activeTab === "syllabus" ? true : undefined}>
                  <SyllabusManager subject={subject} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}