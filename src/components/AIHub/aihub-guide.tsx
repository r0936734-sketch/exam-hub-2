import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BadgeCheck, KeyRound, MessageCircle, Radio, ShieldCheck, Sparkles } from "lucide-react";
import aiBotGif from "../../../ai.gif";
import aiGateGif from "../../../ai2.gif";

type GuideMode = "locked" | "active" | "gate";

const lockedQuestions = [
  {
    question: "Can AI Hub solve your study doubts?",
    answer:
      "It is built for exam practice: generated questions, answer checking, model answers, and topic-wise improvement hints.",
  },
  {
    question: "Why is access limited?",
    answer:
      "Every evaluation uses AI requests, so access is controlled to keep the tool stable for selected students.",
  },
  {
    question: "How do I get access?",
    answer:
      "Message @Sitaaram1001 on Telegram or ask in the UP LT group for your personal AI Hub passcode. Once enabled, this page unlocks automatically.",
  },
  {
    question: "What happens after access?",
    answer:
      "You can generate exam-style questions, swap practice variants, upload handwritten answers, and track progress by topic.",
  },
];

const gateLines = [
  "Passcode tunnel is standing by.",
  "Your AI Hub session unlocks for this browser tab.",
  "Keep your passcode private. The evaluator waits inside.",
];

function useTypewriter(lines: string[], speed = 28, pause = 1500) {
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setLineIndex(0);
    setVisibleText("");
  }, [lines]);

  useEffect(() => {
    const currentLine = lines[lineIndex] ?? "";

    if (visibleText.length < currentLine.length) {
      const timer = window.setTimeout(() => {
        setVisibleText(currentLine.slice(0, visibleText.length + 1));
      }, speed);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setVisibleText("");
      setLineIndex((index) => (index + 1) % lines.length);
    }, pause);
    return () => window.clearTimeout(timer);
  }, [lineIndex, lines, pause, speed, visibleText]);

  return visibleText;
}

export function AIHubGuide({ mode }: { mode: GuideMode }) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const selectedQuestion = lockedQuestions[activeQuestionIndex];
  const typedGateLine = useTypewriter(gateLines, 24, 1400);
  const typedLockedAnswer = useTypewriter(
    useMemo(() => [selectedQuestion.answer], [selectedQuestion.answer]),
    18,
    5000,
  );

  if (mode === "active") {
    return (
      <Card className="ai-hub-panel ai-guide-card mb-6 overflow-hidden rounded-xl p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="ai-guide-bot ai-guide-soft-frame relative h-14 w-14 shrink-0 rounded-lg p-1.5 sm:h-16 sm:w-16">
              <img
                src={aiBotGif}
                alt="AI Hub guide"
                className="h-full w-full object-contain"
              />
              <span className="ai-guide-orbit" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4" />
                AI Hub assistant
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Generate questions, evaluate handwritten answers, and review topic progress in one place.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground md:min-w-72">
            <div className="ai-guide-stat rounded-md border border-border bg-background/45 px-3 py-2">
              <span className="block font-bold">3</span>
              variants
            </div>
            <div className="ai-guide-stat rounded-md border border-border bg-background/45 px-3 py-2">
              <span className="block font-bold">1</span>
              evaluator
            </div>
            <div className="ai-guide-stat rounded-md border border-border bg-background/45 px-3 py-2">
              <span className="block font-bold">Live</span>
              feedback
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (mode === "gate") {
    return (
      <Card className="ai-hub-panel ai-guide-card h-full overflow-hidden rounded-xl p-4 sm:p-5">
        <div className="flex h-full flex-col justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4" />
                Secure access check
              </p>
              <span className="ai-guide-pulse-dot" />
            </div>

            <div className="ai-guide-gate-bot ai-guide-soft-frame relative mx-auto h-28 w-28 rounded-xl p-2 sm:h-36 sm:w-36 md:h-40 md:w-40">
              <img src={aiGateGif} alt="AI Hub access guide" className="h-full w-full object-contain" />
              <span className="ai-guide-scan" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/45 p-3 sm:p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Radio className="h-4 w-4" />
              Access terminal
            </p>
            <p className="ai-guide-typing min-h-12 text-sm leading-6 text-muted-foreground">
              {typedGateLine}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="ai-hub-panel ai-guide-card overflow-hidden rounded-xl p-0">
      <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="relative flex min-h-44 items-center justify-center overflow-hidden border-b border-border bg-background/35 p-4 lg:border-b-0 lg:border-r sm:min-h-52">
          <div className="ai-guide-bot ai-guide-soft-frame relative h-28 w-28 rounded-xl p-2.5 sm:h-36 sm:w-36 lg:h-44 lg:w-44">
            <img
              src={aiBotGif}
              alt="AI Hub guide"
              className="h-full w-full object-contain"
            />
            <span className="ai-guide-orbit" />
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              <MessageCircle className="h-4 w-4" />
              Ask before access
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              AI Hub access guide
            </h2>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {lockedQuestions.map((item, index) => (
              <Button
                key={item.question}
                type="button"
                variant={activeQuestionIndex === index ? "default" : "outline"}
                className="ai-guide-choice h-auto justify-start whitespace-normal px-3 py-2 text-left"
                onClick={() => setActiveQuestionIndex(index)}
              >
                {item.question}
              </Button>
            ))}
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-900 dark:text-cyan-100">
              <BadgeCheck className="h-4 w-4" />
              {selectedQuestion.question}
            </p>
            <p className="ai-guide-typing min-h-16 text-sm leading-6 text-foreground">
              {typedLockedAnswer}
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-background/45 p-3 text-sm text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
            <span>
              Need access? Message <span className="font-semibold text-cyan-700 dark:text-cyan-300">@Sitaaram1001</span> on Telegram. If you already received a passcode, refresh after access is enabled.
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
