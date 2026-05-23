import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, ClipboardCheck, BookOpen, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDashboard } from "@/services/api";

export const Route = createFileRoute("/_app/admin/dashboard")({ component: AdminDashboard });

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getAdminDashboard,
  });

  return (
    <div>
      <PageHeader
        title="Admin overview"
        description="Platform-wide statistics and pending tasks."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Total Students"
              value={data.stats.totalStudents}
              icon={<Users className="size-5" />}
            />
            <StatCard
              label="Total Submissions"
              value={data.stats.totalSubmissions}
              icon={<FileText className="size-5" />}
            />
            <StatCard
              label="Pending Evaluations"
              value={data.stats.pendingEvaluations}
              icon={<ClipboardCheck className="size-5" />}
              trend={{ value: "Needs attention", positive: false }}
            />
            <StatCard
              label="Published Tests"
              value={data.stats.publishedTests}
              icon={<BookOpen className="size-5" />}
            />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top performers</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/admin/users">
                View all <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.topStudents.map((s) => (
              <div
                key={s.userId}
                className="flex items-center justify-between py-2.5 border-b last:border-0 border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                    #{s.rank}
                  </div>
                  <div>
                    <p className="text-sm font-medium">@{s.username}</p>
                    <p className="text-xs text-muted-foreground">{s.testsAttempted} tests</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold">{s.averageScore}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending evaluations</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/admin/submissions">
                Open queue <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead className="text-right">Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.studentName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.testTitle}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{p.files}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
