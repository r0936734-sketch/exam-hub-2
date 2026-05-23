import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Upload, X, FileImage, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTestDetails, submitTestAnswers } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tests/$testId")({ component: TestDetails });

function TestDetails() {
  const { testId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn: () => getTestDetails(testId),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;
    const accepted = Array.from(selected).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf",
    );
    setFiles((prev) => [...prev, ...accepted]);
  };

  const remove = (idx: number) => setFiles((f) => f.filter((_, i) => i !== idx));

  const submit = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one answer file.");
      return;
    }
    setSubmitting(true);
    try {
      await submitTestAnswers(testId, files);
      setShowSuccess(true);
      setFiles([]);
    } catch {
      toast.error("Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 gap-2">
        <Link to="/tests">
          <ArrowLeft className="size-4" /> All tests
        </Link>
      </Button>

      <div className="flex flex-col gap-2 mb-8">
        <Badge variant="outline" className="self-start">
          {data.test.subject}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{data.test.title}</h1>
        <p className="text-muted-foreground">{data.test.description}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {data.questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                    {q.number}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {q.marks} marks
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{q.text}</p>
                {q.image && (
                  <img
                    src={q.image}
                    alt={`Question ${q.number}`}
                    className="mt-4 rounded-lg border max-h-72 object-contain w-full bg-muted"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:sticky lg:top-6 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload your answers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Upload className="size-6 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground">
                  Images or PDF, multiple files supported
                </p>
              </label>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Selected ({files.length})
                  </p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                      {f.type.startsWith("image/") ? (
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="size-10 rounded object-cover"
                        />
                      ) : (
                        <div className="size-10 rounded bg-accent grid place-items-center">
                          <FileImage className="size-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(f.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => remove(i)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={submit}
                disabled={submitting || files.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit answers"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <div className="size-12 rounded-full bg-success/15 text-success grid place-items-center mb-2">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle>Submission received</DialogTitle>
            <DialogDescription>
              Your answers were uploaded successfully. You'll be notified once evaluation is
              complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild>
              <Link to="/tests">Back to tests</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
