import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Trophy, Medal, Award } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaderboardServerFn } from "@/server/leaderboard.server";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/leaderboard")({ component: LeaderboardPage });

function LeaderboardPage() {
  const { user } = useAuth();
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const result = await getLeaderboardServerFn();
      return result.leaderboard;
    },
  });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!leaderboardData) return [];
    const s = q.toLowerCase().trim();
    return s
      ? leaderboardData.filter(
          (d) => d.name.toLowerCase().includes(s) || d.userId.toLowerCase().includes(s),
        )
      : leaderboardData;
  }, [leaderboardData, q]);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description="Global student rankings based on average marks."
      />

      {!isLoading && leaderboardData && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {leaderboardData.slice(0, 3).map((s, i) => {
            const Icon = [Trophy, Medal, Award][i];
            const bg = [
              "bg-warning/15 text-warning",
              "bg-muted text-muted-foreground",
              "bg-accent text-accent-foreground",
            ][i];
            return (
              <Card key={s.rank} className={cn("border-border/60", i === 0 && "sm:scale-105")}>
                <CardContent className="p-4 sm:p-5 text-center">
                  <div
                    className={cn(
                      "size-10 sm:size-12 rounded-full grid place-items-center mx-auto mb-2",
                      bg,
                    )}
                  >
                    <Icon className="size-5 sm:size-6" />
                  </div>
                  <p className="text-xs text-muted-foreground">Rank #{s.rank}</p>
                  <p className="font-semibold mt-1 text-sm sm:text-base truncate">{s.name}</p>
                  <p className="text-xl sm:text-2xl font-mono font-semibold mt-1">
                    {s.avgMarks.toFixed(1)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or student ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden sm:table-cell">User ID</TableHead>
                    <TableHead className="text-right">Tests</TableHead>
                    <TableHead className="text-right">Avg Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const me = row.userId === user?.id;
                    return (
                      <TableRow
                        key={row.userId}
                        className={cn(me && "bg-accent/40 hover:bg-accent/50")}
                      >
                        <TableCell className="font-mono font-medium">#{row.rank}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                              {row.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium">{row.name}</span>
                            {me && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                                YOU
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-xs font-mono">
                          {row.userId}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.totalTests}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {row.avgMarks.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
