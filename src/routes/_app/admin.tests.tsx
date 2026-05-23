import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Edit, Image as ImageIcon, X } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getTests, createTest } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/tests")({ component: AdminTests });

type DraftQuestion = { id: string; text: string; image?: string; marks: number };

function AdminTests() {
  const { data, refetch } = useQuery({ queryKey: ["tests"], queryFn: getTests });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  const addQuestion = () =>
    setQuestions((q) => [...q, { id: crypto.randomUUID(), text: "", marks: 5 }]);
  const removeQuestion = (id: string) => setQuestions((q) => q.filter((x) => x.id !== id));
  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) =>
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const saveTest = async (publish: boolean) => {
    if (!title || !subject) {
      toast.error("Title and subject are required.");
      return;
    }
    await createTest({
      title,
      subject,
      deadline,
      questions,
      status: publish ? "published" : "draft",
    });
    toast.success(publish ? "Test published" : "Draft saved");
    setOpen(false);
    setTitle("");
    setSubject("");
    setDeadline("");
    setQuestions([]);
    refetch();
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
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Calculus midterm"
                    />
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Mathematics"
                    />
                  </div>
                </div>
                <div>
                  <Label>Submission deadline</Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Questions ({questions.length})</Label>
                    <Button size="sm" variant="outline" onClick={addQuestion} className="gap-1.5">
                      <Plus className="size-3.5" /> Add question
                    </Button>
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
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              <ImageIcon className="size-4" /> Attach image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file)
                                    updateQuestion(q.id, { image: URL.createObjectURL(file) });
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
                          {q.image && (
                            <img src={q.image} className="rounded max-h-32 object-contain" alt="" />
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
              <DialogFooter>
                <Button variant="outline" onClick={() => saveTest(false)}>
                  Save as draft
                </Button>
                <Button onClick={() => saveTest(true)}>Publish test</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        {data?.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline" className="text-xs">
                    {t.subject}
                  </Badge>
                  <h3 className="mt-2 font-semibold">{t.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.totalQuestions} questions · due {new Date(t.deadline).toLocaleDateString()}
                  </p>
                </div>
                <Badge>Published</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1">
                  <Edit className="size-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
