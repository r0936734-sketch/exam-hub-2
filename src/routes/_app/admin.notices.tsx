import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createNoticeServerFn,
  deleteNoticeServerFn,
  getAdminNoticesServerFn,
} from "@/services/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/notices")({ component: AdminNotices });

function AdminNotices() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-notices", token],
    queryFn: async () => getAdminNoticesServerFn({ data: { token: token || "" } }),
    enabled: Boolean(token),
  });

  const create = async () => {
    if (!text.trim()) {
      toast.error("Notice text is required");
      return;
    }

    setSaving(true);
    try {
      await createNoticeServerFn({ data: { token: token || "", text } });
      toast.success("Notice posted");
      setText("");
      setOpen(false);
      refetch();
    } catch (error) {
      toast.error((error as Error).message || "Failed to post notice");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (noticeId: string) => {
    const confirmed = window.confirm("Delete this notice?");
    if (!confirmed) return;

    setDeleting(noticeId);
    try {
      await deleteNoticeServerFn({ data: { token: token || "", noticeId } });
      toast.success("Notice deleted");
      refetch();
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete notice");
    } finally {
      setDeleting(null);
    }
  };

  const notices = data?.notices || [];

  return (
    <div>
      <PageHeader
        title="Notice management"
        description="Post text notices for all students."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Add notice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create notice</DialogTitle>
              </DialogHeader>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write the notice for students..."
                className="min-h-36"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Posting...
                    </>
                  ) : (
                    "Post notice"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
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
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Megaphone className="size-4" />
                    </div>
                    <div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{notice.text}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Posted by {notice.adminName} ({notice.adminId}) on{" "}
                        {new Date(notice.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(notice.id)}
                    disabled={deleting === notice.id}
                    aria-label="Delete notice"
                  >
                    {deleting === notice.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
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
