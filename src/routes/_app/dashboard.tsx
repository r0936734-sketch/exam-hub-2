import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, FileText, TrendingUp, Trophy } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDashboard } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: getStudentDashboard,
  });

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "Student"}`}
        description="Here's a snapshot of your progress and upcoming work."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Average Marks"
              value={`${data.stats.averageMarks}%`}
              icon={<TrendingUp className="size-5" />}
              trend={{ value: "+4.2% this month", positive: true }}
            />
            <StatCard
              label="Tests Attempted"
              value={data.stats.totalTests}
              icon={<FileText className="size-5" />}
            />
            <StatCard
              label="Current Rank"
              value={`#${data.stats.currentRank}`}
              icon={<Trophy className="size-5" />}
              trend={{ value: `of ${data.stats.totalStudents} students`, positive: true }}
            />
            <StatCard label="Top Score" value="92" icon={<Award className="size-5" />} />
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent scores</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-40" />
          ) : (
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
                      <Badge variant={pct >= 85 ? "default" : "secondary"} className="font-mono">
                        {s.score}/{s.total}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
