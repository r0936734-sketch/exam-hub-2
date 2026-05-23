import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Trophy, UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStudentProfileServerFn } from "@/services/profile.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-profile", token],
    queryFn: async () => {
      const result = await getStudentProfileServerFn({ data: { token: token || "" } });
      return result.profile;
    },
    enabled: Boolean(token),
  });

  if (isLoading) return <Skeleton className="h-56" />;

  if (isError || !data) {
    return (
      <div>
        <PageHeader title="My profile" description="Student details from your account." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Unable to load profile details.
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = data.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <PageHeader title="My profile" description="Student details from your account." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm font-semibold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{data.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{data.userId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Average marks</p>
                <p className="mt-1 text-2xl font-semibold">{data.avgMarks.toFixed(1)}%</p>
              </div>
              <BarChart3 className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rank</p>
                <p className="mt-1 text-2xl font-semibold">
                  {data.rank ? `#${data.rank}` : "Unranked"}
                </p>
              </div>
              {data.rank ? (
                <Trophy className="size-5 text-muted-foreground" />
              ) : (
                <UserRound className="size-5 text-muted-foreground" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
