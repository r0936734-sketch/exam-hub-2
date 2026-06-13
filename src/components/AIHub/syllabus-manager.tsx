import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Loader2, AlertCircle, ListChecks, Trophy, Activity } from "lucide-react";
import { getCategorizedTopicsFn, getUserProgressFn } from "@/services/aihub.server";

interface TopicCategory {
  name: string;
  subtopics: string[];
  description?: string;
}

interface SyllabusManagerProps {
  subject: string;
}

interface TopicProgress {
  topic: string;
  attempts: number;
  averageScore: number;
  lastScore?: number;
}

function normalizeTopic(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getMasteryColor(averageScore: number) {
  if (averageScore >= 8) {
    return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  if (averageScore >= 6) {
    return "border-lime-300 bg-lime-50 text-lime-950 dark:border-lime-500/50 dark:bg-lime-950/40 dark:text-lime-100";
  }
  if (averageScore >= 4) {
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100";
  }
  if (averageScore > 0) {
    return "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-100";
  }
  return "border-gray-200 bg-gray-50 text-gray-800 dark:border-border dark:bg-muted/40 dark:text-foreground";
}

export function SyllabusManager({ subject }: SyllabusManagerProps) {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [topicProgress, setTopicProgress] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSyllabus = async () => {
      setLoading(true);
      setError("");

      try {
        const [syllabusData, progressData] = await Promise.all([
          getCategorizedTopicsFn({ data: { subject } }),
          getUserProgressFn({ data: subject }),
        ]);

        if (syllabusData.error) {
          setError(syllabusData.error || "Failed to load syllabus");
          return;
        }

        setCategories(syllabusData.categories || []);
        setTopicProgress(progressData.error ? [] : progressData.topicProgress || []);
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
  const progressByTopic = useMemo(
    () =>
      new Map(
        topicProgress.map((progress) => [normalizeTopic(progress.topic), progress]),
      ),
    [topicProgress],
  );
  const syllabusProgress = useMemo(
    () =>
      categories
        .flatMap((category) => category.subtopics)
        .map((topic) => progressByTopic.get(normalizeTopic(topic)))
        .filter((progress): progress is TopicProgress => Boolean(progress)),
    [categories, progressByTopic],
  );
  const practicedCount = syllabusProgress.filter((progress) => progress.attempts > 0).length;
  const masteredCount = syllabusProgress.filter((progress) => progress.averageScore >= 8).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="ai-hub-panel rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="ai-hub-kicker mb-2">Syllabus intelligence</p>
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold">{subject} Syllabus</h2>
            </div>
            <p className="text-gray-600">
              Questions are generated from the built-in syllabus configured in the server seed file.
            </p>
          </div>

          <div className="ai-hub-pill rounded-lg px-4 py-3 text-sm">
            <div className="font-semibold">{categories.length} units</div>
            <div>{topicCount} topics</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="ai-hub-stat-card rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Activity className="h-4 w-4 text-blue-600" />
            Practiced
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {practicedCount}/{topicCount}
          </p>
        </Card>
        <Card className="ai-hub-stat-card rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy className="h-4 w-4 text-emerald-600" />
            Complete
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {masteredCount}/{topicCount}
          </p>
        </Card>
        <Card className="ai-hub-stat-card rounded-xl p-4">
          <div className="text-sm font-medium text-muted-foreground">Completion rule</div>
          <p className="mt-2 text-sm text-foreground">
            A topic is full when its average score reaches 8 marks.
          </p>
        </Card>
      </div>

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
          <Card key={category.name} className="ai-hub-panel rounded-xl p-5">
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
              {category.subtopics.map((topic) => {
                const progress = progressByTopic.get(normalizeTopic(topic));
                const averageScore = progress?.averageScore ?? 0;
                const fillPercent = Math.min(100, Math.max(0, (averageScore / 8) * 100));
                const isComplete = averageScore >= 8;

                return (
                  <div
                    key={`${category.name}-${topic}`}
                    className={`relative overflow-hidden rounded-md border px-3 py-2 text-sm ${getMasteryColor(averageScore)}`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-current/10"
                      style={{ width: `${fillPercent}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1">{topic}</span>
                      <span className="shrink-0 rounded border border-current/20 bg-background/70 px-2 py-0.5 text-xs font-medium">
                        {progress
                          ? isComplete
                            ? "Complete"
                            : `${averageScore.toFixed(1)}/8`
                          : "New"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
