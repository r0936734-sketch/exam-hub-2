import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStudentServerFn } from "@/server/admin.server";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["all-students"],
    queryFn: getAllStudents,
  });
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", password: "" });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const s = q.toLowerCase().trim();
    return s
      ? data.filter((d) => d.name.toLowerCase().includes(s) || d.userId.toLowerCase().includes(s))
      : data;
  }, [data, q]);

  const create = async () => {
    if (!form.name || !form.password) {
      toast.error("Name and password are required");
      return;
    }
    setSaving(true);
    try {
      await createStudentServerFn({ token: token || "", name: form.name, password: form.password });
      toast.success("Student account created");
      setOpen(false);
      setForm({ name: "", password: "" });
      refetch();
    } catch (err) {
      toast.error((err as Error).message || "Failed to create student");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    await toggleStudentActive(id, active);
    toast.success(active ? "Student activated" : "Student deactivated");
    refetch();
  };

  return (
    <div>
      <PageHeader
        title="Student management"
        description="Create, search and manage student accounts."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Add student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create student account</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Priya Singh"
                  />
                </div>
                <div>
                  <Label>Initial password</Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter a password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  User ID will be auto-generated (STU001, STU002, etc.)
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or student ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-72" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">User ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                        {s.userId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch checked={s.active} onCheckedChange={(c) => toggle(s.id, c)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
