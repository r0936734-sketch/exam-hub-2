import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStudentNoticesServerFn } from "@/services/student.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/notices")({ component: StudentNotices });

function StudentNotices() {
  const { token, user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["student-notices", token],
    queryFn: async () => getStudentNoticesServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token),
  });

  const notices = data?.notices || [];

  useEffect(() => {
    if (notices[0]?.id && user?.id) {
      localStorage.setItem(`lt_grade_seen_notice.${user.id}`, notices[0].id);
    }
  }, [notices, user?.id]);

  return (
    <div>
      <PageHeader
        title="Notices"
        description="Important updates shared by your admins."
      />

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : notices.length > 0 ? (
        <div className="grid gap-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex gap-3">
                  <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Megaphone className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{notice.text}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Posted by {notice.adminName} ({notice.adminId}) on{" "}
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No notices have been posted yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
