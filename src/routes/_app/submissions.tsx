import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileImage, Images, Info, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRecentSubmissionsByTestServerFn } from "@/services/student.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/submissions")({ component: SubmissionsPage });

function SubmissionsPage() {
  const { token } = useAuth();
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  
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
                            <div
                              key={`${submission.id}-${imageUrl}-${index}`}
                              className="overflow-hidden rounded-md border bg-background transition-colors hover:border-primary"
                            >
                              {brokenImages.has(imageUrl) ? (
                                <div className="aspect-[3/4] w-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
                                  <AlertCircle className="size-5" />
                                  <p className="text-xs mt-1">Unavailable</p>
                                </div>
                              ) : (
                                <a
                                  href={imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    src={imageUrl}
                                    alt={`${submission.studentName} answer ${index + 1}`}
                                    className="aspect-[3/4] w-full object-cover"
                                    onError={() => {
                                      setBrokenImages((prev) => new Set([...prev, imageUrl]));
                                    }}
                                  />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-background text-muted-foreground">
                          <div className="text-center">
                            <FileImage className="mx-auto size-7" />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center gap-1 mt-2 cursor-help">
                                    <p className="text-sm">Images deleted after 2 days</p>
                                    <Info className="size-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p>Images are automatically deleted 2 days after submission to save storage space. This helps us keep ExamHub free and accessible.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
