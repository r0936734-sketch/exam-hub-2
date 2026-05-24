import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileImage, Images } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecentSubmissionsByTestServerFn } from "@/services/student.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/submissions")({ component: SubmissionsPage });

function SubmissionsPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["submissions-gallery", token],
    queryFn: async () => getRecentSubmissionsByTestServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token),
  });

  const tests = data?.tests || [];
  const totalSubmissions = tests.reduce((total, test) => total + test.submissions.length, 0);

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="All submitted answers with student names and uploaded images."
      />

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : tests.length > 0 ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Images className="size-4" />
            Showing {totalSubmissions} submissions across {tests.length} tests
          </div>

          {tests.map((test) => (
            <Card key={test.testId} className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">{test.testTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {test.submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">{submission.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {submission.studentId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted {new Date(submission.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={submission.status === "evaluated" ? "default" : "secondary"}>
                          {submission.status}
                        </Badge>
                        {submission.marks !== null && (
                          <Badge variant="outline">{submission.marks} marks</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      {submission.images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {submission.images.map((imageUrl, index) => (
                            <a
                              key={`${submission.id}-${imageUrl}-${index}`}
                              href={imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-md border bg-background transition-colors hover:border-primary"
                            >
                              <img
                                src={imageUrl}
                                alt={`${submission.studentName} answer ${index + 1}`}
                                className="aspect-[3/4] w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-background text-muted-foreground">
                          <div className="text-center">
                            <FileImage className="mx-auto size-7" />
                            <p className="mt-2 text-sm">No images attached</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No submissions have been uploaded yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
