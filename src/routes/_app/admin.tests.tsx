import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Image as ImageIcon, X, Type } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTestServerFn, getTestsServerFn, deleteTestServerFn } from "@/services/admin.functions";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/admin/tests")({ component: AdminTests });

// Simple UUID generator
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

type DraftQuestion = {
  id: string;
  text: string;
  base64Image?: string;
  imageUrl?: string;
  imagePublicId?: string;
  marks: number;
};

type DraftTest = {
  title: string;
  subject: string;
  deadline: string;
  questions: Array<Omit<DraftQuestion, "base64Image">>;
};

const DRAFT_STORAGE_KEY = "exam-hub-test-draft";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

// Returns "YYYY-MM-DDTHH:mm" in local time — exactly what datetime-local needs
function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function AdminTests() {
  const { token } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const { data: tests = [], refetch } = useQuery({
    queryKey: ["tests", token],
    queryFn: async () => {
      const result = await getTestsServerFn({ data: { token: token || "" } });
      return result.tests || [];
    },
    enabled: Boolean(token),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [showQuestionTypeDialog, setShowQuestionTypeDialog] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [minDateTime, setMinDateTime] = useState("");

  // Load draft on component mount
  useEffect(() => {
    setMinDateTime(toLocalDateTimeString(new Date()));

    const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draft) {
      try {
        const parsed: DraftTest = JSON.parse(draft);
        setTitle(parsed.title);
        setSubject(parsed.subject);
        setDeadline(parsed.deadline);
        setQuestions(parsed.questions);
      } catch (e) {
        // Silent failure - draft not loaded
      }
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (title || subject || questions.length > 0) {
      const draftQuestions = questions.map(q => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        imagePublicId: q.imagePublicId,
        marks: q.marks,
      }));
      const draft: DraftTest = { title, subject, deadline, questions: draftQuestions };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [title, subject, deadline, questions]);

  if (pathname !== "/admin/tests") {
    return <Outlet />;
  }

  const handleImageUpload = async (file: File, questionId: string) => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`Image must be less than 2MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateQuestion(questionId, { base64Image: base64 });
    };
    reader.readAsDataURL(file);

    setUploadingQuestionId(questionId);
    try {
      const result = await uploadImageToCloudinary(file, "submissions");
      updateQuestion(questionId, {
        imageUrl: result.secureUrl,
        imagePublicId: result.publicId,
      });
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error((error as Error).message || "Failed to upload image");
    } finally {
      setUploadingQuestionId(null);
    }
  };

  const addTextQuestion = () => {
    setQuestions((q) => [...q, { id: generateId(), text: "", marks: 5 }]);
    setShowQuestionTypeDialog(false);
  };

  const addImageQuestion = () => {
    setQuestions((q) => [...q, { id: generateId(), text: "Image Question", marks: 5 }]);
    setShowQuestionTypeDialog(false);
  };

  const removeQuestion = (id: string) => {
    setQuestions((q) => q.filter((x) => x.id !== id));
  };

  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) => {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setTitle("");
    setSubject("");
    setDeadline("");
    setQuestions([]);
  };

  const saveTest = async (publish: boolean) => {
    if (!title || !subject) {
      toast.error("Title and subject are required.");
      return;
    }

    if (questions.length === 0) {
      toast.error("Add at least one question.");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text?.trim() && !questions[i].imageUrl) {
        toast.error(`Question ${i + 1} needs text or an uploaded image`);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (!token) {
        throw new Error("Authentication lost. Please refresh the page.");
      }

      const questionsToSave = questions.map((q) => ({
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        imagePublicId: q.imagePublicId,
        marks: q.marks,
      }));

      // Convert the local datetime string to a proper ISO string for MongoDB.
      // datetime-local gives "YYYY-MM-DDTHH:mm" in local time; new Date() parses
      // it as local, then .toISOString() converts to UTC — exactly what MongoDB wants.
      const deadlineISO = deadline ? new Date(deadline).toISOString() : "";

      const result = await createTestServerFn({
        data: {
          token,
          title,
          subject,
          deadline: deadlineISO,
          questions: questionsToSave,
          status: publish ? "published" : "draft",
        },
      });

      if (!result || !result.ok) {
        throw new Error(result?.message || "Failed to save test");
      }

      toast.success(publish ? "Test published successfully" : "Test saved as draft");
      clearDraft();
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error((error as Error).message || "Failed to save test");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setDeletingTestId(testId);
    try {
      await deleteTestServerFn({ data: { token, testId } });
      toast.success("Test deleted successfully");
      refetch();
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete test");
    } finally {
      setDeletingTestId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Test management"
        description="Create, edit and publish tests for your students."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> New test
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Create new test</DialogTitle>
                <DialogDescription>Upload questions with images and set test parameters</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Process Scheduling"
                    />
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="OS"
                    />
                  </div>
                </div>

                {/* ── Deadline ──────────────────────────────────────────────────
                    Uses a native <input type="datetime-local"> styled to match
                    the design system. Shadcn's <Input> passes through all props
                    correctly, but some global CSS rules (pointer-events, z-index)
                    can block the browser's native calendar picker. Using the
                    native element directly avoids that entirely.
                ──────────────────────────────────────────────────────────────── */}
                <div>
                  <Label htmlFor="test-deadline">Submission deadline</Label>
                  <input
                    id="test-deadline"
                    type="datetime-local"
                    min={minDateTime}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    // Matches shadcn Input styles exactly
                    className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors
                               file:border-0 file:bg-transparent file:text-sm file:font-medium
                               placeholder:text-muted-foreground
                               focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                               disabled:cursor-not-allowed disabled:opacity-50
                               cursor-pointer
                               [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  {deadline && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deadline:{" "}
                      {new Date(deadline).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Questions ({questions.length})</Label>
                    <Dialog open={showQuestionTypeDialog} onOpenChange={setShowQuestionTypeDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Plus className="size-3.5" /> Add question
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Choose question type</DialogTitle>
                          <DialogDescription>Select text or image-based questions</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3">
                          <Button
                            onClick={addTextQuestion}
                            variant="outline"
                            className="h-auto flex-col items-start p-4 gap-2 justify-start"
                          >
                            <Type className="size-5" />
                            <div className="text-left">
                              <div className="font-semibold">Text Question</div>
                              <div className="text-xs text-muted-foreground">
                                Question with text only
                              </div>
                            </div>
                          </Button>
                          <Button
                            onClick={addImageQuestion}
                            variant="outline"
                            className="h-auto flex-col items-start p-4 gap-2 justify-start"
                          >
                            <ImageIcon className="size-5" />
                            <div className="text-left">
                              <div className="font-semibold">Image Question</div>
                              <div className="text-xs text-muted-foreground">
                                Question with image attachment
                              </div>
                            </div>
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <Card key={q.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Question {i + 1}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => removeQuestion(q.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Question text..."
                            value={q.text}
                            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          />
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground disabled:opacity-50">
                              <ImageIcon className="size-4" /> Attach image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingQuestionId === q.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(file, q.id);
                                }}
                              />
                            </label>
                            <div className="ml-auto flex items-center gap-2">
                              <Label className="text-xs">Marks</Label>
                              <Input
                                type="number"
                                value={q.marks}
                                onChange={(e) =>
                                  updateQuestion(q.id, { marks: Number(e.target.value) })
                                }
                                className="w-20 h-8"
                              />
                            </div>
                          </div>
                          {uploadingQuestionId === q.id && (
                            <div className="text-xs text-muted-foreground animate-pulse">
                              Uploading image...
                            </div>
                          )}
                          {q.base64Image && (
                            <div className="relative">
                              <img
                                src={q.base64Image}
                                className="rounded max-h-32 object-contain"
                                alt="Question preview"
                              />
                              {q.imageUrl && (
                                <Badge className="absolute top-2 left-2 bg-green-600">
                                  Uploaded
                                </Badge>
                              )}
                            </div>
                          )}
                          {q.imageUrl && !q.base64Image && (
                            <div className="relative">
                              <img
                                src={q.imageUrl}
                                className="rounded max-h-32 object-contain"
                                alt="Question"
                              />
                              <Badge className="absolute top-2 left-2 bg-green-600">
                                Uploaded
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-1 right-1 size-6 bg-black/50 hover:bg-black/70"
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    imageUrl: undefined,
                                    imagePublicId: undefined,
                                  })
                                }
                              >
                                <X className="size-3 text-white" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {questions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
                        No questions yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => saveTest(false)} disabled={isSaving}>
                  Save as draft
                </Button>
                <Button onClick={() => saveTest(true)} disabled={isSaving}>
                  {isSaving ? "Publishing..." : "Publish test"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        {tests.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              No tests created yet. Click "New test" to get started.
            </p>
          </div>
        ) : (
          tests.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {t.subject}
                    </Badge>
                    <h3 className="mt-2 font-semibold">{t.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.totalQuestions} questions · due{" "}
                      {t.deadline
                        ? new Date(t.deadline).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "No deadline"}
                    </p>
                  </div>
                  <Badge variant={t.status === "published" ? "default" : "secondary"}>
                    {t.status}
                  </Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <Link to="/admin/tests/$testId" params={{ testId: t.id }}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Edit className="size-3.5" /> Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={deletingTestId === t.id}
                    onClick={() => handleDeleteTest(t.id)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
