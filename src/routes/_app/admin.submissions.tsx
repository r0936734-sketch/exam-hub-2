import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileImage, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPendingSubmissions, evaluateSubmission } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/submissions")({ component: AdminSubmissions });

function AdminSubmissions() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pending-submissions"],
    queryFn: getPendingSubmissions,
  });
  const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  if (data.length === 0)
    return <div className="text-center py-16 text-muted-foreground">No pending submissions.</div>;

  const current = data[idx];

  const submit = async () => {
    if (!marks) {
      toast.error("Enter marks first.");
      return;
    }
    setSubmitting(true);
    try {
      await evaluateSubmission(current.id, Number(marks), feedback);
      toast.success("Evaluation submitted");
      setMarks("");
      setFeedback("");
      if (idx < data.length - 1) setIdx(idx + 1);
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Submission evaluation"
        description={`Reviewing ${idx + 1} of ${data.length} pending submissions`}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={idx === 0}
              onClick={() => setIdx(idx - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={idx === data.length - 1}
              onClick={() => setIdx(idx + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{current.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Student ID</p>
                <p className="font-mono">{current.studentId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Test</p>
                <p className="font-medium">{current.testTitle}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p>{new Date(current.submittedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uploaded answers ({current.files} files)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: current.files }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-lg border bg-muted/50 grid place-items-center text-muted-foreground"
                  >
                    <div className="text-center">
                      <FileImage className="size-8 mx-auto" />
                      <p className="text-xs mt-2">answer_{i + 1}.jpg</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="self-start lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="marks">Marks awarded</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="marks"
                  type="number"
                  placeholder="0"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
            <div>
              <Label htmlFor="fb">Feedback</Label>
              <Textarea
                id="fb"
                rows={5}
                placeholder="Comments for the student..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="text-xs">
              Submission #{current.id}
            </Badge>
            <Button className="w-full" onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit evaluation"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
