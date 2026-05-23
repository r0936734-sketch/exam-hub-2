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
import { getTestDetailServerFn, submitTestAnswersServerFn } from "@/services/student.functions";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tests/$testId")({ component: TestDetails });

const MAX_ANSWER_IMAGES = 2;

interface QuestionAnswer {
  questionId: string;
  text: string;
  imageUrls: string[];
  imagePublicIds: string[];
}

function markTestAttempted(testId: string, userId: string) {
  try {
    const key = `exampro.attemptedTests.${userId}`;
    const attempted = JSON.parse(localStorage.getItem(key) || "[]") as string[];
    if (!attempted.includes(testId)) {
      localStorage.setItem(key, JSON.stringify([...attempted, testId]));
    }
  } catch {
    localStorage.setItem(`exampro.attemptedTests.${userId}`, JSON.stringify([testId]));
  }
}

function TestDetails() {
  const { testId } = Route.useParams();
  const { token, user } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getTestDetailServerFn({ data: { token, testId } });
    },
    enabled: !!token,
  });

  const [answers, setAnswers] = useState<Map<string, QuestionAnswer>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);

  const handleAnswerTextChange = (questionId: string, text: string) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      const existing = newAnswers.get(questionId) || {
        questionId,
        text: "",
        imageUrls: [],
        imagePublicIds: [],
      };
      newAnswers.set(questionId, { ...existing, text });
      return newAnswers;
    });
  };

  const handleImageUpload = async (file: File, questionId: string) => {
    const totalImages = Array.from(answers.values()).reduce(
      (total, answer) => total + answer.imageUrls.length,
      0,
    );

    if (totalImages >= MAX_ANSWER_IMAGES) {
      toast.error(`You can upload a maximum of ${MAX_ANSWER_IMAGES} answer images.`);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(`Image must be less than 2MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    setUploadingQuestionId(questionId);
    try {
      if (!token) {
        throw new Error("Not authenticated");
      }

      const result = await uploadImageToCloudinary(file, "submissions");

      setAnswers((prev) => {
        const newAnswers = new Map(prev);
        const existing = newAnswers.get(questionId) || {
          questionId,
          text: "",
          imageUrls: [],
          imagePublicIds: [],
        };
        newAnswers.set(questionId, {
          ...existing,
          imageUrls: [...(existing.imageUrls || []), result.secureUrl],
          imagePublicIds: [...(existing.imagePublicIds || []), result.publicId],
        });
        return newAnswers;
      });
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error((error as Error).message || "Failed to process image");
    } finally {
      setUploadingQuestionId(null);
    }
  };

  const removeImage = (questionId: string, index: number) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      const existing = newAnswers.get(questionId);
      if (existing) {
        existing.imageUrls.splice(index, 1);
        existing.imagePublicIds.splice(index, 1);
        newAnswers.set(questionId, { ...existing });
      }
      return newAnswers;
    });
  };

  const submit = async () => {
    const submissionAnswers = Array.from(answers.values());

    if (submissionAnswers.length === 0) {
      toast.error("Please provide at least one answer.");
      return;
    }

    // Validate that at least one answer has content
    const hasContent = submissionAnswers.some(
      (a) => a.text.trim() || a.imageUrls.length > 0
    );

    if (!hasContent) {
      toast.error("Please provide text or image answers.");
      return;
    }

    setSubmitting(true);
    try {
      if (!token) {
        throw new Error("Not authenticated");
      }

      await submitTestAnswersServerFn({
        data: {
          token,
          testId,
          answers: submissionAnswers,
        },
      });

      markTestAttempted(testId, user?.id || "student");
      setShowSuccess(true);
      setAnswers(new Map());
    } catch (error) {
      toast.error((error as Error).message || "Submission failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const alreadySubmitted = Boolean(data.test.alreadySubmitted);

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
        <p className="text-muted-foreground">
          {data.test.totalQuestions} questions • Due{" "}
          {new Date(data.test.deadline).toLocaleDateString()}
        </p>
        <p className="text-sm text-muted-foreground">
          Uploaded by {data.test.uploadedByAdminName} ({data.test.uploadedByAdminId})
        </p>
        {alreadySubmitted && (
          <Badge variant="secondary" className="w-fit">
            Already submitted
            {data.test.submittedAt
              ? ` on ${new Date(data.test.submittedAt).toLocaleDateString()}`
              : ""}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {data.questions.map((q: any) => {
            const answer = answers.get(q.id);
            return (
              <Card key={q.id}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                      {q.number}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {q.marks} marks
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm leading-relaxed font-medium">{q.text}</p>
                    {q.imageUrl && (
                      <img
                        src={q.imageUrl}
                        alt={`Question ${q.number}`}
                        className="mt-3 rounded-lg border max-h-72 object-contain w-full bg-muted"
                      />
                    )}
                  </div>

                  <div className="space-y-3 mt-4 pt-4 border-t">
                    {alreadySubmitted ? (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                        You have already submitted this test. New answers cannot be added.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium">Your Answer</label>
                          <Textarea
                            placeholder="Type your answer here..."
                            value={answer?.text || ""}
                            onChange={(e) => handleAnswerTextChange(q.id, e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium block mb-2">
                            Add Images (max {MAX_ANSWER_IMAGES} per test, max 2MB each)
                          </label>
                          <div className="flex gap-2">
                            <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:border-primary/50 transition">
                              <FileImage className="size-4" />
                              <span className="text-xs">Add image</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={
                                  uploadingQuestionId === q.id ||
                                  Array.from(answers.values()).reduce(
                                    (total, row) => total + row.imageUrls.length,
                                    0,
                                  ) >= MAX_ANSWER_IMAGES
                                }
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file, q.id);
                                }}
                              />
                            </label>
                          </div>

                          {uploadingQuestionId === q.id && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" /> Uploading...
                            </div>
                          )}

                          {answer?.imageUrls && answer.imageUrls.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {answer.imageUrls.map((url, idx) => (
                                <div key={idx} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Answer ${idx + 1}`}
                                    className="rounded-lg border object-cover h-24 w-full bg-muted"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute top-1 right-1 size-6 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition"
                                    onClick={() => removeImage(q.id, idx)}
                                  >
                                    <X className="size-3 text-white" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                {alreadySubmitted ? (
                  "This test is already submitted."
                ) : (
                  <>
                    <span className="font-medium">{answers.size}</span> of{" "}
                    <span className="font-medium">{data.questions.length}</span> questions answered
                  </>
                )}
              </div>
              <Button
                onClick={submit}
                disabled={alreadySubmitted || submitting || answers.size === 0}
                className="w-full gap-2"
              >
                {alreadySubmitted ? (
                  "Already submitted"
                ) : submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" /> Submit Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="text-center">
          <CheckCircle2 className="size-12 mx-auto text-green-600" />
          <DialogHeader>
            <DialogTitle>Test submitted successfully!</DialogTitle>
            <DialogDescription>
              Your answers have been recorded. Your teacher will review and provide feedback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild className="w-full">
              <Link to="/tests">Back to tests</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
