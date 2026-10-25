import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, RotateCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useExamMode } from "@/hooks/useExamMode";
import { buildMcqSet, getCorrectOptionDistribution, type McqQuestion } from "@/lib/mcq-engine";

export const Route = createFileRoute("/_app/practice")({ component: PracticePage });

function PracticePage() {
  const { mode } = useExamMode();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const selected = useMemo(
    () => mode.syllabus.filter((topic) => selectedTopics.includes(topic.id)),
    [mode.syllabus, selectedTopics],
  );
  const distribution = useMemo(() => getCorrectOptionDistribution(questions), [questions]);
  const score = questions.reduce((total, question) => total + Number(answers[question.id] === question.correctIndex), 0);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((current) => current.includes(topicId)
      ? current.filter((id) => id !== topicId)
      : [...current, topicId]);
  };

  const startPractice = () => {
    const next = buildMcqSet(selected, count);
    setQuestions(next);
    setAnswers({});
    setShowResults(false);
  };

  if (mode.format === "descriptive") {
    return (
      <div>
        <PageHeader title="MCQ Practice" description="Objective practice is available for DSSSB TGT CS and UGC NET CS." />
        <Card className="max-w-2xl border-border/60">
          <CardContent className="p-6">
            <Badge>LT Grade descriptive mode</Badge>
            <h2 className="mt-3 text-xl font-semibold">Keep answer writing at the center of LT Grade preparation.</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your current exam mode uses the existing descriptive tests, image uploads, and admin evaluation workflow. Select DSSSB TGT CS or UGC NET CS when you need objective MCQ practice.
            </p>
            <Button asChild className="mt-5"><Link to="/tests">Open descriptive tests</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length) {
    return (
      <div>
        <PageHeader title={`${mode.shortTitle} practice`} description={`${questions.length} concept-led questions across ${selected.length} selected topic${selected.length === 1 ? "" : "s"}.`} />
        <Card className="mb-5 border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span><strong>{Object.keys(answers).length}</strong> of {questions.length} answered</span>
            <Button onClick={() => setShowResults(true)} disabled={Object.keys(answers).length !== questions.length}>Finish and review</Button>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          {questions.map((question, index) => {
            const chosen = answers[question.id];
            return (
              <Card key={question.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
                      <div>
                        <Badge variant="outline" className="mb-2 text-xs">{question.topicTitle}</Badge>
                        <p className="font-medium leading-relaxed">{question.prompt}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => {
                      const isCorrect = optionIndex === question.correctIndex;
                      const isChosen = chosen === optionIndex;
                      const resultClass = showResults
                        ? isCorrect ? "border-emerald-500 bg-emerald-500/10" : isChosen ? "border-destructive bg-destructive/10" : ""
                        : isChosen ? "border-primary bg-primary/5" : "hover:border-primary/50";
                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={showResults}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                          className={`flex min-h-12 items-center gap-3 rounded-lg border p-3 text-left text-sm transition disabled:cursor-default ${resultClass}`}
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {showResults && (
                    <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                      <strong>{chosen === question.correctIndex ? "Correct. " : "Review: "}</strong>{question.explanation}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {showResults && (
          <Card className="sticky bottom-4 mt-5 border-primary/30 shadow-lg">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div><p className="font-semibold">Score: {score}/{questions.length}</p><p className="text-xs text-muted-foreground">Correct options: {Object.entries(distribution).map(([label, value]) => `${label}: ${value}`).join(" · ")} · Every answer includes an explanation.</p></div>
              <Button variant="outline" onClick={() => setQuestions([])} className="gap-2"><RotateCcw className="size-4" /> Build another set</Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`${mode.shortTitle} MCQ builder`} description="Choose one or more topics, set the question count, and get a mixed hard-practice set." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">1. Select topics</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2 border-b pb-4">
              <Button size="sm" variant="outline" onClick={() => setSelectedTopics(mode.syllabus.map((topic) => topic.id))}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTopics([])}>Clear</Button>
              <span className="self-center text-xs text-muted-foreground">{selectedTopics.length} selected</span>
            </div>
            {mode.syllabus.map((topic) => (
              <label key={topic.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition hover:border-primary/50">
                <Checkbox checked={selectedTopics.includes(topic.id)} onCheckedChange={() => toggleTopic(topic.id)} className="mt-0.5" />
                <span>
                  {topic.section && <span className="mb-1 block text-xs font-medium text-primary">{topic.section}</span>}
                  <span className="block text-sm font-semibold">{topic.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{topic.subtopics.join(" · ")}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="border-border/60 lg:sticky lg:top-4">
            <CardHeader><CardTitle className="text-lg">2. Build your set</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="grid gap-2 text-sm font-medium">Question count
                <Input type="number" min={5} max={50} step={5} value={count} onChange={(event) => setCount(Math.max(5, Math.min(50, Number(event.target.value) || 5)))} />
              </label>
              <Button className="w-full gap-2" disabled={!selected.length} onClick={startPractice}><Sparkles className="size-4" /> Create MCQs</Button>
              {!selected.length && <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300"><CircleAlert className="size-4 shrink-0" /> Select at least one topic to continue.</p>}
            </CardContent>
          </Card>
          <Card className="border-emerald-500/25 bg-emerald-500/5">
            <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground"><div className="mb-2 flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 className="size-4 text-emerald-600" /> Anti-pattern safeguards</div>Correct options are shuffled, then balanced across A–D. Distractors are distinct, plausible, and kept comparable in length so option position or length cannot reveal the answer.</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
