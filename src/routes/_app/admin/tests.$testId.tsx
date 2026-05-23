import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getTestsServerFn } from "@/services/admin.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app/admin/tests/$testId")({
  component: AdminTestDetail,
});

function AdminTestDetail() {
  const { testId } = Route.useParams();
  const { token } = useAuth();

  const { data: testsData, isLoading } = useQuery({
    queryKey: ["admin-tests"],
    queryFn: () => {
      if (!token) throw new Error("Not authenticated");
      return getTestsServerFn({ data: { token } });
    },
    enabled: !!token,
  });

  const test = testsData?.tests.find((t: any) => t.id === testId);

  if (isLoading) return <Skeleton className="h-96" />;
  if (!test) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Test not found</p>
        <Button asChild className="mt-4">
          <Link to="/admin/tests">Back to tests</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 gap-2">
        <Link to="/admin/tests">
          <ArrowLeft className="size-4" /> All tests
        </Link>
      </Button>

      <div className="flex flex-col gap-2 mb-8">
        <Badge variant="outline" className="self-start">
          {test.subject}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{test.title}</h1>
        <p className="text-muted-foreground">
          {test.totalQuestions} questions • Due{" "}
          {test.deadline ? new Date(test.deadline).toLocaleDateString() : "Not set"}
        </p>
        <Badge variant={test.status === "published" ? "default" : "secondary"} className="w-fit">
          {test.status}
        </Badge>
      </div>

      <div className="space-y-4">
        {test.questions && test.questions.length > 0 ? (
          test.questions.map((q: any, idx: number) => (
            <Card key={q.id}>
              <CardContent className="p-6">
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold shrink-0">
                    {idx + 1}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {q.marks} marks
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed">{q.text}</p>
                {q.imageUrl && (
                  <img
                    src={q.imageUrl}
                    alt={`Question ${idx + 1}`}
                    className="mt-4 rounded-lg border max-h-72 object-contain w-full bg-muted"
                  />
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground text-center py-6">No questions</p>
        )}
      </div>
    </div>
  );
}
