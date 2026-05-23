import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Mail, Calendar, Trophy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStudentProfile } from "@/services/api";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: getStudentProfile });

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const { student, stats, performance, submissions } = data;

  return (
    <div>
      <PageHeader title="My profile" description="Personal details and academic performance." />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="size-20 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto text-2xl font-semibold">
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <h2 className="mt-4 text-xl font-semibold">{student.name}</h2>
            <p className="text-sm text-muted-foreground">@{student.username}</p>
            <Badge variant="outline" className="mt-3">
              {student.classGroup}
            </Badge>
            <div className="mt-6 space-y-3 text-sm text-left">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="size-4" /> {student.email}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="size-4" /> Joined{" "}
                {new Date(student.joinedAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Trophy className="size-4" /> Rank #{stats.currentRank} of {stats.totalStudents}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Performance trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-2xl font-semibold">{stats.averageMarks}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tests</p>
                <p className="text-2xl font-semibold">{stats.totalTests}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="text-2xl font-semibold">#{stats.currentRank}</p>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[60, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Submission history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.testTitle}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "evaluated" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {s.score != null ? `${s.score}/${s.total}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
