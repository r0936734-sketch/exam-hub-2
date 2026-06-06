import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Loader2, AlertCircle, ListChecks } from "lucide-react";
import { getCategorizedTopicsFn } from "@/services/aihub.server";

interface TopicCategory {
  name: string;
  subtopics: string[];
  description?: string;
}

interface SyllabusManagerProps {
  subject: string;
}

export function SyllabusManager({ subject }: SyllabusManagerProps) {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSyllabus = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getCategorizedTopicsFn({ data: { subject } });

        if (data.error) {
          setError(data.error || "Failed to load syllabus");
          return;
        }

        setCategories(data.categories || []);
      } catch (err) {
        setError("Failed to load syllabus");
      } finally {
        setLoading(false);
      }
    };

    if (subject) {
      fetchSyllabus();
    }
  }, [subject]);

  const topicCount = useMemo(
    () => categories.reduce((total, category) => total + category.subtopics.length, 0),
    [categories],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold">{subject} Syllabus</h2>
            </div>
            <p className="text-gray-600">
              Questions are generated from the built-in syllabus configured in the server seed file.
            </p>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="font-semibold">{categories.length} units</div>
            <div>{topicCount} topics</div>
          </div>
        </div>
      </Card>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {!error && categories.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-amber-900">
            No syllabus topics are configured for this subject.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        {categories.map((category) => (
          <Card key={category.name} className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <ListChecks className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                {category.description && (
                  <p className="text-sm text-gray-600">{category.description}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {category.subtopics.map((topic) => (
                <div
                  key={`${category.name}-${topic}`}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                >
                  {topic}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
