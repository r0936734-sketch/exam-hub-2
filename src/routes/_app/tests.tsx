import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileText, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTests } from "@/services/api";

export const Route = createFileRoute("/_app/tests")({ component: TestsPage });

function TestsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["tests"], queryFn: getTests });

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
          {data?.map((t) => {
            const submitted = t.status === "submitted";
            return (
              <Card key={t.id} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {t.subject}
                      </Badge>
                      <h3 className="mt-3 font-semibold text-lg">{t.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                    <Badge variant={submitted ? "secondary" : "default"} className="shrink-0">
                      {submitted ? "Submitted" : "Pending"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="size-4" /> {t.totalQuestions} questions
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-4" />{" "}
                      {new Date(t.deadline).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                  <Button
                    asChild
                    className="mt-5 w-full gap-2"
                    variant={submitted ? "secondary" : "default"}
                  >
                    <Link to="/tests/$testId" params={{ testId: t.id }}>
                      {submitted ? "Review submission" : "Open test"}{" "}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
