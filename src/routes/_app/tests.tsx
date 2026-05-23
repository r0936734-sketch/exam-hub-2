import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Calendar, FileText, ArrowRight, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMySubmissionsServerFn, getPublishedTestsServerFn } from "@/services/student.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/tests")({ component: TestsPage });

function TestsPage() {
  const { token, user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [attemptedCache, setAttemptedCache] = useState<string[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ["tests"],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getPublishedTestsServerFn({ data: { token } });
    },
    enabled: !!token,
  });
  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ["my-submissions", token],
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

  const attemptedTestIds = useMemo(
    () => new Set(attemptedCache),
    [attemptedCache],
  );

  useEffect(() => {
    try {
      setAttemptedCache(
        JSON.parse(localStorage.getItem(`exampro.attemptedTests.${user?.id || "student"}`) || "[]"),
      );
    } catch {
      setAttemptedCache([]);
    }
  }, [submissionsData, user?.id]);

  if (pathname !== "/tests") {
    return <Outlet />;
  }

  return (
    <div>
      <PageHeader
        title="Available tests"
        description="All published tests assigned to your group."
      />
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data?.tests && data.tests.length > 0 ? (
            data.tests.map((t) => {
              const attempted =
                t.studentStatus === "attempted" ||
                attemptedTestIds.has(t.id || "") ||
                submittedTestIds.has(t.id || "");

              return (
              <Card key={t.id} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {t.subject}
                      </Badge>
                      <h3 className="mt-3 font-semibold text-lg">{t.title}</h3>
                    </div>
                    <Badge variant={attempted ? "secondary" : "default"} className="shrink-0">
                      {attempted ? "Attempted" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="size-4" />
                      {t.totalQuestions} questions
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-4" />
                      {new Date(t.deadline).toLocaleDateString()}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Uploaded by {t.uploadedByAdminName} ({t.uploadedByAdminId})
                  </p>
                  <Button asChild className="mt-6 w-full gap-2" variant={attempted ? "secondary" : "default"}>
                    <Link to="/tests/$testId" params={{ testId: t.id || "" }}>
                      {attempted ? "View test" : "Answer test"} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">No tests available yet.</p>
            </div>
          )}
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Submitted answers</h2>
            <p className="text-sm text-muted-foreground">
              Marks and admin remarks for your submitted tests.
            </p>
          </div>
        </div>

        {submissionsLoading ? (
          <Skeleton className="h-36 rounded-xl" />
        ) : submissionsData && submissionsData.length > 0 ? (
          <div className="grid gap-3">
            {submissionsData.map((submission) => (
              <Card key={submission.id} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{submission.testTitle}</h3>
                        <Badge
                          variant={submission.status === "evaluated" ? "default" : "secondary"}
                        >
                          {submission.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Uploaded by {submission.uploadedByAdminName} ({submission.uploadedByAdminId})
                      </p>
                      <div className="mt-3 grid gap-1.5">
                        {submission.questions.map((question: any) => (
                          <div key={question.id} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="font-mono text-xs">
                              {question.id}
                            </Badge>
                            <span className="text-muted-foreground line-clamp-1">
                              {question.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="md:text-right">
                      <p className="text-xs text-muted-foreground">Marks</p>
                      <p className="text-2xl font-semibold">{submission.marks}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium">Admin remarks</p>
                        {submission.evaluatedByAdminId && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Checked by {submission.evaluatedByAdminName} ({submission.evaluatedByAdminId})
                          </p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {submission.feedback || "No remarks yet."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              You have not submitted any answers yet.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
