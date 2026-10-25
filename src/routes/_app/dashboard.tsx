import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Bell,
  Clock,
  FileText,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMySubmissionsServerFn,
  getPublishedTestsServerFn,
  getStudentDashboardServerFn,
} from "@/services/student.functions";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

const EXAM_DATE = new Date("2026-08-15T00:00:00+05:30");

function getTimeLeft() {
  const diff = Math.max(0, EXAM_DATE.getTime() - Date.now());
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

/* ─── Exam countdown ───────────────────────────────────────────────────────── */

function ExamCountdown() {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number } | null>(null);

  useEffect(() => {
    const update = () => setTimeLeft(getTimeLeft());
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="mt-6 overflow-hidden border-border/60">
      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_1.25fr]">
          <div className="bg-primary text-primary-foreground p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/80">
              <Clock className="size-4" /> Time left till 15 August 2026
            </div>
            <div className="mt-5 flex items-end gap-5">
              <div>
                <p className="text-5xl font-semibold tracking-tight">
                  {timeLeft ? timeLeft.days : "--"}
                </p>
                <p className="text-xs uppercase tracking-wide text-primary-foreground/75">Days</p>
              </div>
              <div className="pb-2 text-3xl text-primary-foreground/60">-</div>
              <div>
                <p className="text-5xl font-semibold tracking-tight">
                  {timeLeft ? timeLeft.hours : "--"}
                </p>
                <p className="text-xs uppercase tracking-wide text-primary-foreground/75">Hours</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-accent text-accent-foreground grid place-items-center shrink-0">
                <Target className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold">Target reminder</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep the 40 percent benchmark in sight. With 682 students for 1,056 total seats,
                  steady preparation and regular answer writing can put you in a strong position.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { user, token } = useAuth();
  const [homeNotice, setHomeNotice] = useState<{
    title: string;
    description: string;
    testId?: string;
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", token],
    queryFn: async () => getStudentDashboardServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token),
  });
  const { data: publishedTestsData } = useQuery({
    queryKey: ["dashboard-published-tests", token],
    queryFn: async () => getPublishedTestsServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token),
  });
  const { data: submissionsData } = useQuery({
    queryKey: ["dashboard-my-submissions", token],
    queryFn: async () => {
      const result = await getMySubmissionsServerFn({ data: { token: token || "" } });
      return result.submissions;
    },
    enabled: Boolean(token),
  });

  const submittedTestIds = useMemo(
    () => new Set((submissionsData || []).map((submission) => submission.testId)),
    [submissionsData],
  );

  useEffect(() => {
    if (!publishedTestsData?.tests?.length || !submissionsData || !user?.id) return;

    const attemptedKey = `exampro.attemptedTests.${user.id}`;
    const seenKey = `exampro.seenPublishedTests.${user.id}`;

    let attempted: string[] = [];
    let seen: Record<string, number> = {};

    try {
      attempted = JSON.parse(localStorage.getItem(attemptedKey) || "[]") as string[];
    } catch {
      attempted = [];
    }

    try {
      seen = JSON.parse(localStorage.getItem(seenKey) || "{}") as Record<string, number>;
    } catch {
      seen = {};
    }

    const attemptedTestIds = new Set(attempted);
    const nextSeen = { ...seen };
    const availableTests = publishedTestsData.tests;

    const newOrUpdated = availableTests.filter((test) => {
      const testId = test.id || "";
      const isAttempted =
        test.studentStatus === "attempted" ||
        attemptedTestIds.has(testId) ||
        submittedTestIds.has(testId);
      const knownQuestionCount = seen[testId];

      nextSeen[testId] = test.totalQuestions;
      return !isAttempted && knownQuestionCount !== undefined && knownQuestionCount < test.totalQuestions;
    });

    const firstUnseen = availableTests.find((test) => {
      const testId = test.id || "";
      const isAttempted =
        test.studentStatus === "attempted" ||
        attemptedTestIds.has(testId) ||
        submittedTestIds.has(testId);
      return !isAttempted && seen[testId] === undefined;
    });

    localStorage.setItem(seenKey, JSON.stringify(nextSeen));

    if (newOrUpdated.length > 0) {
      setHomeNotice({
        title: "New question added",
        description: `${newOrUpdated[0].title} has new questions to answer.`,
        testId: newOrUpdated[0].id,
      });
      return;
    }

    if (firstUnseen) {
      setHomeNotice({
        title: "New test available",
        description: `${firstUnseen.title} is ready to answer.`,
        testId: firstUnseen.id,
      });
      return;
    }

    setHomeNotice(null);
  }, [publishedTestsData?.tests, submissionsData, submittedTestIds, user?.id]);

  return (
    <div>
      <PageHeader
        title={`UP LT Grade Computer Prep, ${user?.name?.split(" ")[0] ?? "Student"}`}
        description="Mains preparation dashboard for the Computer subject."
      />

      {homeNotice && (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <Bell className="size-4" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <AlertTitle>{homeNotice.title}</AlertTitle>
              <AlertDescription>{homeNotice.description}</AlertDescription>
            </div>
            <div className="flex items-center gap-2">
              {homeNotice.testId && (
                <Button asChild size="sm">
                  <Link to="/tests/$testId" params={{ testId: homeNotice.testId }}>
                    Open
                  </Link>
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setHomeNotice(null)}
                aria-label="Dismiss notification"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Average Marks"
              value={data.stats.averageMarks.toFixed(1)}
              icon={<TrendingUp className="size-5" />}
            />
            <StatCard
              label="Tests Attempted"
              value={data.stats.totalTests}
              icon={<FileText className="size-5" />}
            />
            <StatCard
              label="Current Rank"
              value={data.stats.currentRank ? `#${data.stats.currentRank}` : "Unranked"}
              icon={<Trophy className="size-5" />}
              trend={{ value: `of ${data.stats.totalStudents} students`, positive: true }}
            />
            <StatCard
              label="Top Score"
              value={data.stats.topScore}
              icon={<Award className="size-5" />}
            />
          </>
        )}
      </div>

      <ExamCountdown />
      {/* Recent scores */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent scores</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-40" />
          ) : data.recentScores.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recentScores.map((s) => {
                const pct = (s.score / s.total) * 100;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(s.date).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block w-32">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge
                        variant={pct >= 85 ? "default" : "secondary"}
                        className="font-mono"
                      >
                        {s.score}/{s.total}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No evaluated scores yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
