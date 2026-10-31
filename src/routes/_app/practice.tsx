import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useExamMode } from "@/hooks/useExamMode";
import { getCorrectOptionDistribution, type McqQuestion } from "@/lib/mcq-engine";
import { STYLE_LABELS, type McqStyleId } from "@/lib/mcq-profiles";
import {
  cancelMcqJobServerFn,
  getActiveMcqAttemptServerFn,
  pollMcqJobServerFn,
  saveMcqAnswerServerFn,
  startMcqJobServerFn,
  submitMcqAttemptServerFn,
} from "@/services/mcq.functions";

export const Route = createFileRoute("/_app/practice")({ component: PracticePage });

type JobStatus = "idle" | "running" | "done" | "error" | "cancelled";
type SlotMeta = { topicId: string; topicTitle: string; subtopic: string; style: string };

const POLL_INTERVAL_MS = 1000;

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/forbidden|session|unauthor/i.test(message)) {
    return "Your session has expired. Please sign in again to generate MCQs.";
  }
  return message || "Something went wrong. Please try again.";
}

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Renders text with preserved line breaks and ``` fenced code blocks. */
function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/```[a-zA-Z0-9+#-]*\n?([\s\S]*?)```/g);
  return (
    <div className={className}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            className="my-2 overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed text-foreground"
          >
            {part.replace(/\n$/, "")}
          </pre>
        ) : part ? (
          <span key={index} className="whitespace-pre-wrap break-words">
            {part}
          </span>
        ) : null,
      )}
    </div>
  );
}

function styleLabel(style?: string) {
  return style && style in STYLE_LABELS ? STYLE_LABELS[style as McqStyleId] : undefined;
}

function PracticePage() {
  const { mode } = useExamMode();
  const { token } = useAuth();

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [instructions, setInstructions] = useState("");

  const [items, setItems] = useState<(McqQuestion | null)[]>([]);
  const [meta, setMeta] = useState<SlotMeta[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [notices, setNotices] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const tokenRef = useRef(token || "");
  tokenRef.current = token || "";
  const attemptIdRef = useRef<string | null>(null);
  const statusRef = useRef<JobStatus>("idle");
  statusRef.current = jobStatus;
  const activeJobRef = useRef<string | null>(null);
  const slotMapRef = useRef<number[]>([]);
  const previousModeRef = useRef(mode.id);

  const selected = useMemo(
    () => mode.syllabus.filter((topic) => selectedTopics.includes(topic.id)),
    [mode.syllabus, selectedTopics],
  );
  const ready = useMemo(() => items.filter((item): item is McqQuestion => item !== null), [items]);
  const isGenerating = jobStatus === "running";
  const missingCount = items.length - ready.length;
  const answeredCount = ready.filter((question) => answers[question.id] !== undefined).length;
  const distribution = useMemo(() => getCorrectOptionDistribution(ready), [ready]);
  const score = ready.reduce(
    (total, question) => total + Number(answers[question.id] === question.correctIndex),
    0,
  );
  const showQuiz = items.length > 0 && (ready.length > 0 || isGenerating);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((current) =>
      current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId],
    );
  };

  useEffect(() => {
    if (!token || mode.format !== "objective") return;
    let cancelled = false;
    setIsLoadingDraft(true);

    void getActiveMcqAttemptServerFn({ data: { token, examModeId: mode.id } })
      .then(({ attempt }) => {
        if (cancelled || !attempt) return;
        const restoredItems = attempt.questions.map((question) =>
          question
            ? {
                id: question.id,
                topicId: question.topicId,
                topicTitle: question.topicTitle,
                subtopic: question.subtopic,
                style: question.style,
                prompt: question.prompt,
                options: question.options,
                correctIndex: question.correctIndex,
                explanation: question.explanation,
              }
            : null,
        );
        attemptIdRef.current = attempt.attemptId;
        setAttemptId(attempt.attemptId);
        setSelectedTopics(attempt.topicIds);
        setCount(attempt.questionCount);
        setInstructions(attempt.instructions);
        setItems(restoredItems);
        setMeta(
          attempt.plan.map((entry) => ({
            topicId: entry?.topicId || "",
            topicTitle: entry?.topicTitle || "",
            subtopic: entry?.subtopic || "",
            style: entry?.style || "",
          })),
        );
        setAnswers(attempt.answers);
        setJobStatus("done");
        setStatusMessage("Your saved practice set has been restored.");
      })
      .catch((error) => {
        if (!cancelled) setGenerationError(friendlyError(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDraft(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, mode.format, mode.id]);

  const cancelRunningJob = () => {
    if (activeJobRef.current && statusRef.current === "running") {
      void cancelMcqJobServerFn({
        data: { token: tokenRef.current, jobId: activeJobRef.current },
      }).catch(() => undefined);
    }
  };

  const resetAll = () => {
    cancelRunningJob();
    activeJobRef.current = null;
    setJobId(null);
    setItems([]);
    setMeta([]);
    setAnswers({});
    attemptIdRef.current = null;
    setAttemptId(null);
    setShowResults(false);
    setJobStatus("idle");
    setStatusMessage("");
    setNotices([]);
    setElapsed(0);
  };

  /** Starts a generation job. `targetIndexes` is set when topping up missing slots of the current set. */
  const launch = async (jobCount: number, targetIndexes?: number[]) => {
    setGenerationError("");
    setIsStarting(true);
    try {
      const started = await startMcqJobServerFn({
        data: {
          token: tokenRef.current,
          examModeId: mode.id,
          topicIds: selectedTopics,
          count: jobCount,
          instructions: instructions.trim() || undefined,
          attemptId: targetIndexes ? attemptIdRef.current || undefined : undefined,
          slotIndexes: targetIndexes,
        },
      });

      const indexes = targetIndexes ?? started.plan.map((_, index) => index);
      slotMapRef.current = indexes;
      const planMeta = started.plan.map(({ topicId, topicTitle, subtopic, style }) => ({
        topicId,
        topicTitle,
        subtopic,
        style,
      }));

      if (targetIndexes) {
        setMeta((current) => {
          const next = [...current];
          planMeta.forEach((entry, i) => {
            next[indexes[i]] = entry;
          });
          return next;
        });
      } else {
        setItems(Array.from({ length: started.total }, () => null));
        setMeta(planMeta);
        setAnswers({});
        setShowResults(false);
      }

      activeJobRef.current = started.jobId;
      attemptIdRef.current = started.attemptId;
      setAttemptId(started.attemptId);
      setNotices([]);
      setStatusMessage("Starting the AI…");
      setElapsed(0);
      setJobStatus("running");
      setJobId(started.jobId);
    } catch (error) {
      setGenerationError(friendlyError(error));
    } finally {
      setIsStarting(false);
    }
  };

  const generateMissing = () => {
    const targets = items.flatMap((item, index) => (item ? [] : [index]));
    if (targets.length) void launch(targets.length, targets);
  };

  const finishAttempt = async () => {
    if (!attemptId || isSubmitting) return;
    setIsSubmitting(true);
    setGenerationError("");
    try {
      await submitMcqAttemptServerFn({
        data: { token: tokenRef.current, attemptId, answers },
      });
      setShowResults(true);
    } catch (error) {
      setGenerationError(friendlyError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Poll the running job and merge finished questions into the page as they arrive. */
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let failures = 0;
    let cursor = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const currentJob = jobId;

    const tick = async () => {
      if (stopped) return;
      try {
        const result = await pollMcqJobServerFn({
          data: { token: tokenRef.current, jobId: currentJob, cursor },
        });
        if (stopped) return;
        failures = 0;

        if (!result.found) {
          setJobStatus("error");
          setGenerationError(result.error || "Generation session lost. Please try again.");
          return;
        }

        cursor = result.cursor;
        if (result.questions.length) {
          setItems((current) => {
            const next = [...current];
            for (const question of result.questions) {
              const index = slotMapRef.current[question.slot];
              if (index === undefined) continue;
              next[index] = {
                id: `${currentJob}-${question.slot}`,
                topicId: question.topicId,
                topicTitle: question.topicTitle,
                subtopic: question.subtopic,
                style: question.style,
                prompt: question.prompt,
                options: question.options,
                correctIndex: question.correctIndex,
                explanation: question.explanation,
              };
            }
            return next;
          });
        }

        setStatusMessage(result.message);
        setNotices(result.notices);

        if (result.status !== "running") {
          setJobStatus(result.status);
          if (result.status === "error" && result.error) setGenerationError(result.error);
          return;
        }
      } catch (error) {
        failures += 1;
        if (failures >= 6) {
          setJobStatus("error");
          setGenerationError(friendlyError(error));
          return;
        }
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  /* Elapsed timer so the page always looks alive. */
  useEffect(() => {
    if (!isGenerating) return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isGenerating, jobId]);

  /* Switching exam mode discards the current set; leaving the page stops generation. */
  useEffect(() => {
    if (previousModeRef.current !== mode.id) {
      previousModeRef.current = mode.id;
      resetAll();
      setSelectedTopics([]);
      setGenerationError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.id]);

  useEffect(() => () => cancelRunningJob(), []);

  if (mode.format === "descriptive") {
    return (
      <div>
        <PageHeader
          title="MCQ Practice"
          description="Objective practice is available for DSSSB TGT CS and UGC NET CS."
        />
        <Card className="max-w-2xl border-border/60">
          <CardContent className="p-6">
            <Badge>LT Grade descriptive mode</Badge>
            <h2 className="mt-3 text-xl font-semibold">
              Keep answer writing at the center of LT Grade preparation.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your current exam mode uses the existing descriptive tests, image uploads, and admin
              evaluation workflow. Select DSSSB TGT CS or UGC NET CS when you need objective MCQ
              practice.
            </p>
            <Button asChild className="mt-5">
              <Link to="/tests">Open descriptive tests</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showQuiz) {
    const rows = items
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => isGenerating || question !== null);
    const progressValue = items.length ? Math.round((ready.length / items.length) * 100) : 0;
    const canFinish = !isGenerating && ready.length > 0 && answeredCount === ready.length;
    let visibleNumber = 0;

    return (
      <div>
        <PageHeader
          title={`${mode.shortTitle} practice`}
          description={`${items.length} questions across ${selected.length} selected topic${selected.length === 1 ? "" : "s"}, written live by AI. Your questions and answers are saved until final submission.`}
        />

        <Card className="sticky top-2 z-20 mb-5 border-primary/20 bg-background/95 shadow-sm backdrop-blur">
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-medium">
                {isGenerating ? (
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                <span>
                  {isGenerating
                    ? `Writing your set live — ${ready.length} of ${items.length} ready`
                    : `${ready.length} question${ready.length === 1 ? "" : "s"} ready`}
                </span>
                {isGenerating && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {formatElapsed(elapsed)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{answeredCount}</strong> of {ready.length} answered
                </span>
                {isGenerating ? (
                  <Button size="sm" variant="outline" className="gap-2" onClick={cancelRunningJob}>
                    <Square className="size-3.5" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void finishAttempt()} disabled={!canFinish || showResults || isSubmitting}>
                    {isSubmitting ? "Submitting…" : "Finish and review"}
                  </Button>
                )}
              </div>
            </div>

            {isGenerating && (
              <>
                <Progress value={progressValue} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {statusMessage || "Working…"} You can start answering the ready questions while the rest are being written.
                </p>
                {notices.length > 0 && (
                  <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {notices[notices.length - 1]}
                  </p>
                )}
              </>
            )}

            {!isGenerating && missingCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <span className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {jobStatus === "cancelled"
                    ? "Generation stopped."
                    : `${missingCount} question${missingCount === 1 ? "" : "s"} could not be generated.`}{" "}
                  Your finished questions are safe.
                </span>
                <Button size="sm" variant="outline" className="gap-2" onClick={generateMissing} disabled={isStarting}>
                  {isStarting ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Generate {missingCount} more
                </Button>
              </div>
            )}

            {generationError && (
              <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                {generationError}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {rows.map(({ question, index }) => {
            const slotMeta = meta[index];

            if (!question) {
              return (
                <Card key={`pending-${index}`} className="border-dashed border-border/70">
                  <CardContent className="p-5">
                    <div className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="w-full space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {slotMeta && (
                            <Badge variant="outline" className="text-xs">
                              {slotMeta.topicTitle}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LoaderCircle className="size-3 animate-spin" />
                            Writing question {index + 1}
                            {slotMeta ? ` · ${slotMeta.subtopic}` : ""}…
                          </span>
                        </div>
                        <Skeleton className="h-4 w-11/12" />
                        <Skeleton className="h-4 w-8/12" />
                        <div className="grid gap-2 pt-1 sm:grid-cols-2">
                          <Skeleton className="h-11" />
                          <Skeleton className="h-11" />
                          <Skeleton className="h-11" />
                          <Skeleton className="h-11" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            visibleNumber += 1;
            const number = isGenerating ? index + 1 : visibleNumber;
            const chosen = answers[question.id];
            const label = styleLabel(question.style);

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-border/60">
                  <CardContent className="p-5">
                    <div className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                        {number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {question.topicTitle}
                          </Badge>
                          {label && (
                            <Badge variant="secondary" className="text-xs">
                              {label}
                            </Badge>
                          )}
                        </div>
                        <RichText text={question.prompt} className="font-medium leading-relaxed" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === question.correctIndex;
                        const isChosen = chosen === optionIndex;
                        const resultClass = showResults
                          ? isCorrect
                            ? "border-emerald-500 bg-emerald-500/10"
                            : isChosen
                              ? "border-destructive bg-destructive/10"
                              : ""
                          : isChosen
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50";
                        return (
                          <button
                            key={optionIndex}
                            type="button"
                            disabled={showResults}
                            onClick={() => {
                              setAnswers((current) => ({ ...current, [question.id]: optionIndex }));
                              if (attemptId) {
                                void saveMcqAnswerServerFn({
                                  data: {
                                    token: tokenRef.current,
                                    attemptId,
                                    questionId: question.id,
                                    answerIndex: optionIndex,
                                  },
                                }).catch((error) => setGenerationError(friendlyError(error)));
                              }
                            }}
                            className={`flex min-h-12 items-start gap-3 rounded-lg border p-3 text-left text-sm transition disabled:cursor-default ${resultClass}`}
                          >
                            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="whitespace-pre-wrap break-words">{option}</span>
                          </button>
                        );
                      })}
                    </div>

                    {showResults && (
                      <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                        <strong>{chosen === question.correctIndex ? "Correct. " : "Review: "}</strong>
                        <RichText text={question.explanation} className="inline" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {showResults && (
          <Card className="sticky bottom-4 mt-5 border-primary/30 shadow-lg">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-semibold">
                  Score: {score}/{ready.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Correct options:{" "}
                  {Object.entries(distribution).map(([label, value], position) => (
                    <Fragment key={label}>
                      {position > 0 && " · "}
                      {label}: {value}
                    </Fragment>
                  ))}{" "}
                  · Every answer includes an explanation.
                </p>
              </div>
              <Button variant="outline" onClick={resetAll} className="gap-2">
                <RotateCcw className="size-4" /> Build another set
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${mode.shortTitle} MCQ builder`}
        description="Choose one or more topics, set the question count, and watch a mixed hard-practice set get written live."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">1. Select topics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2 border-b pb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTopics(mode.syllabus.map((topic) => topic.id))}
              >
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTopics([])}>
                Clear
              </Button>
              <span className="self-center text-xs text-muted-foreground">{selectedTopics.length} selected</span>
            </div>
            {mode.syllabus.map((topic) => (
              <label
                key={topic.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition hover:border-primary/50"
              >
                <Checkbox
                  checked={selectedTopics.includes(topic.id)}
                  onCheckedChange={() => toggleTopic(topic.id)}
                  className="mt-0.5"
                />
                <span>
                  {topic.section && (
                    <span className="mb-1 block text-xs font-medium text-primary">{topic.section}</span>
                  )}
                  <span className="block text-sm font-semibold">{topic.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {topic.subtopics.join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-lg">2. Build your set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-2 text-sm font-medium">
                Question count
                <Input
                  type="number"
                  min={5}
                  max={50}
                  step={5}
                  value={count}
                  onChange={(event) => setCount(Math.max(5, Math.min(50, Number(event.target.value) || 5)))}
                />
                {selected.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ≈ {Math.max(1, Math.round(count / selected.length))} per selected topic
                  </span>
                )}
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Special focus <span className="font-normal text-muted-foreground">(optional)</span>
                <Textarea
                  rows={2}
                  maxLength={400}
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="e.g. more numericals, trickier statements"
                />
              </label>
              <Button
                className="w-full gap-2"
                disabled={!selected.length || isStarting || isLoadingDraft}
                onClick={() => void launch(count)}
              >
                {isStarting || isLoadingDraft ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isLoadingDraft ? "Loading saved set…" : isStarting ? "Starting…" : "Generate MCQs with AI"}
              </Button>
              {!selected.length && (
                <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <CircleAlert className="size-4 shrink-0" /> Select at least one topic to continue.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-emerald-500/25 bg-emerald-500/5">
            <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" /> Exam-style set
              </div>
              {mode.id === "ugc-net-cs"
                ? "Mixes direct concepts with statement-type, match-the-following, assertion–reason and trace questions in real UGC NET style."
                : "Matches the DSSSB pattern: general awareness, reasoning, quant, Hindi and English plus Computer Science and pedagogy."}{" "}
              Correct options are balanced across A–D in a shuffled order, and distractors are kept the same length so position or length never gives the answer away.
            </CardContent>
          </Card>
        </div>
      </div>
      {generationError && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {generationError}
        </p>
      )}
    </div>
  );
}
