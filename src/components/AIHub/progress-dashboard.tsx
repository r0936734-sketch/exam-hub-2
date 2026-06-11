import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, TrendingUp, AlertCircle, CalendarDays } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getUserProgressFn,
  getWeakTopicsFn,
  getEvaluationHistoryFn,
} from "@/services/aihub.server";

interface ProgressDashboardProps {
  subject: string;
}

interface TopicProgress {
  topic: string;
  attempts: number;
  averageScore: number;
  lastScore: number;
  difficulty: "easy" | "medium" | "hard";
  strongAreas: string[];
  weakAreas: string[];
  lastAttemptDate?: string | Date;
}

interface EvaluationHistoryItem {
  evaluatedAt: string | Date;
  score: number;
  maxMarks: number;
  subject?: string;
}

interface ActivityDay {
  date: Date;
  key: string;
  count: number;
  isFuture: boolean;
}

interface ActivityCell {
  key: string;
  day: ActivityDay | null;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function formatActivityDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getActivityCellClass(count: number) {
  if (count === 0) return "bg-slate-800/70 border-slate-700";
  if (count === 1) return "bg-emerald-900/70 border-emerald-800";
  if (count === 2) return "bg-emerald-700 border-emerald-600";
  if (count <= 4) return "bg-teal-500 border-teal-400";
  if (count <= 7) return "bg-cyan-400 border-cyan-300";
  return "bg-sky-300 border-sky-200";
}

export function ProgressDashboard({ subject }: ProgressDashboardProps) {
  const [progress, setProgress] = useState<any | null>(null);
  const [weakTopics, setWeakTopics] = useState<TopicProgress[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scoreChartScrollRef = useRef<HTMLDivElement | null>(null);
  const scoreDragStateRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      setError("");

      try {
        const [progressData, weakData, historyData] = await Promise.all([
          getUserProgressFn({ data: subject }),
          getWeakTopicsFn({ data: subject }),
          getEvaluationHistoryFn(),
        ]);

        if (!progressData.error) {
          setProgress(progressData);
        }
        if (!weakData.error) {
          setWeakTopics(weakData.topics || []);
        }
        if (!historyData.error) {
          setEvaluationHistory(historyData.history || []);
        }
      } catch (err) {
        setError("Failed to fetch progress data");
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [subject]);

  // Prepare chart data from evaluation history
  const chartData = (evaluationHistory || [])
    .filter((evaluation: EvaluationHistoryItem) => !evaluation.subject || evaluation.subject === subject)
    .map((evaluation: EvaluationHistoryItem) => {
      const evaluatedAt = new Date(evaluation.evaluatedAt);
      return {
        date: evaluatedAt.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        timestamp: evaluatedAt.getTime(),
        score: evaluation.score,
        maxMarks: evaluation.maxMarks,
        percentage: Math.round((evaluation.score / evaluation.maxMarks) * 100),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const answerActivity = useMemo(() => {
    const counts = new Map<string, number>();
    const today = startOfLocalDay(new Date());
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    (evaluationHistory || []).forEach((evaluation: EvaluationHistoryItem) => {
      if (evaluation.subject && evaluation.subject !== subject) return;
      const evaluatedAt = new Date(evaluation.evaluatedAt);
      if (Number.isNaN(evaluatedAt.getTime())) return;

      const evaluatedDay = startOfLocalDay(evaluatedAt);
      if (evaluatedDay < startDate || evaluatedDay > today) return;

      const key = toDateKey(evaluatedAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const daysInRange =
      Math.floor((today.getTime() - startDate.getTime()) / 86_400_000) + 1;

    const days: ActivityDay[] = [];
    for (let offset = 0; offset < daysInRange; offset++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + offset);
      const key = toDateKey(date);

      days.push({
        date,
        key,
        count: date <= today ? counts.get(key) ?? 0 : 0,
        isFuture: date > today,
      });
    }

    const mondayStartOffset = (startDate.getDay() + 6) % 7;
    const cells: ActivityCell[] = [
      ...Array.from({ length: mondayStartOffset }, (_, index) => ({
        key: `empty-start-${index}`,
        day: null,
      })),
      ...days.map((day) => ({ key: day.key, day })),
    ];
    const trailingCellCount = (7 - (cells.length % 7)) % 7;
    for (let index = 0; index < trailingCellCount; index++) {
      cells.push({ key: `empty-end-${index}`, day: null });
    }

    return {
      cells,
      monthLabel: startDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      startLabel: startDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      weekdayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      total: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
      activeDays: Array.from(counts.values()).filter((count) => count > 0).length,
      maxCount: Math.max(0, ...Array.from(counts.values())),
    };
  }, [evaluationHistory, subject]);

  // Get topic performance data
  const topicPerformance = (progress?.topicProgress || []).map((data: any) => ({
    topic: data.topic,
    averageScore: data.averageScore ?? data.lastScore ?? 0,
    attempts: data.attempts || 0,
  }));
  const topicProgressByName = useMemo(
    () =>
      new Map<string, TopicProgress>(
        (progress?.topicProgress || []).map((data: any) => [
          String(data.topic).toLowerCase(),
          {
            topic: data.topic,
            attempts: data.attempts || 0,
            averageScore: data.averageScore ?? data.lastScore ?? 0,
            lastScore: data.lastScore ?? 0,
            difficulty: data.difficulty,
            strongAreas: data.strongAreas ?? [],
            weakAreas: data.weakAreas ?? [],
            lastAttemptDate: data.lastAttemptDate,
          },
        ]),
      ),
    [progress?.topicProgress],
  );
  const scoreChartWidth = Math.max(680, chartData.length * 58);
  const topicChartWidth = Math.max(760, topicPerformance.length * 76);

  // Calculate stats properly
  const totalAttempts = progress?.overallAttempts || 0;
  const topicsCovered = topicPerformance.length;
  const weakTopicsCount = (progress?.topicProgress || []).filter(
    (tp: any) => tp.lastScore && (tp.lastScore / 12) * 100 < 50
  ).length;

  const handleScoreChartPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = scoreChartScrollRef.current;
    if (!element) return;

    scoreDragStateRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
    };
    element.setPointerCapture(event.pointerId);
  };

  const handleScoreChartPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = scoreChartScrollRef.current;
    if (!element || !scoreDragStateRef.current.active) return;

    const distance = event.clientX - scoreDragStateRef.current.startX;
    element.scrollLeft = scoreDragStateRef.current.scrollLeft - distance;
  };

  const stopScoreChartDrag = (event: PointerEvent<HTMLDivElement>) => {
    const element = scoreChartScrollRef.current;
    scoreDragStateRef.current.active = false;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  };

  const handleChartPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartScrollRef.current;
    if (!element) return;

    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
    };
    element.setPointerCapture(event.pointerId);
  };

  const handleChartPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartScrollRef.current;
    if (!element || !dragStateRef.current.active) return;

    const distance = event.clientX - dragStateRef.current.startX;
    element.scrollLeft = dragStateRef.current.scrollLeft - distance;
  };

  const stopChartDrag = (event: PointerEvent<HTMLDivElement>) => {
    const element = chartScrollRef.current;
    dragStateRef.current.active = false;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Attempts</h3>
          <p className="text-3xl font-bold text-blue-600">
            {progress?.overallAttempts || 0}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Average Score</h3>
          <p className="text-3xl font-bold text-green-600">
            {(progress?.overallAverageScore || 0).toFixed(1)}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Topics Covered</h3>
          <p className="text-3xl font-bold text-purple-600">
            {topicPerformance.length}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Weak Topics</h3>
          <p className="text-3xl font-bold text-red-600">
            {weakTopicsCount}
          </p>
        </Card>
      </div>

      {/* Answer Activity Heat Map */}
      <Card className="p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-teal-500" />
              Answer Activity
            </h3>
            <p className="text-sm text-muted-foreground">
              Since {answerActivity.startLabel}: {answerActivity.total} submissions across{" "}
              {answerActivity.activeDays} active days
            </p>
          </div>
          <div className="rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm text-teal-200">
            Peak day: {answerActivity.maxCount}
          </div>
        </div>

        <TooltipProvider delayDuration={120}>
          <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {answerActivity.monthLabel}
                </p>
                <p className="text-xs text-slate-400">
                  Counts are from saved answer evaluations
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium text-slate-400">
              {answerActivity.weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {answerActivity.cells.map((cell) => {
                if (!cell.day) {
                  return <span key={cell.key} className="min-h-14 rounded-md" />;
                }

                const day = cell.day;
                const submissionLabel =
                  day.count === 1 ? "1 answer submission" : `${day.count} answer submissions`;
                const tooltipText = `${submissionLabel} on ${formatActivityDate(day.date)}`;

                return (
                  <Tooltip key={day.key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={tooltipText}
                        className={`group min-h-14 rounded-md border p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${getActivityCellClass(day.count)}`}
                      >
                        <span className="block text-xs font-semibold text-white/90">
                          {day.date.getDate()}
                        </span>
                        <span className="mt-1 block text-lg font-bold leading-none text-white">
                          {day.count}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white">
                      {tooltipText}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>

        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-400">
          <span>Less</span>
          {[0, 1, 2, 4, 7, 8].map((count) => (
            <span
              key={count}
              className={`h-4 w-4 rounded border ${getActivityCellClass(count)}`}
            />
          ))}
          <span>More</span>
        </div>
      </Card>

      {/* Score Trend Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Score Trend
            </h3>
            <span className="text-xs text-muted-foreground">Drag sideways to review attempts</span>
          </div>
          <div
            ref={scoreChartScrollRef}
            className="overflow-x-auto overscroll-x-contain cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleScoreChartPointerDown}
            onPointerMove={handleScoreChartPointerMove}
            onPointerUp={stopScoreChartDrag}
            onPointerCancel={stopScoreChartDrag}
            onPointerLeave={(event) => {
              if (scoreDragStateRef.current.active) stopScoreChartDrag(event);
            }}
          >
            <div style={{ width: scoreChartWidth, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 28, left: 0, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={18} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip
                    formatter={(value) => `${value}%`}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#3b82f6" }}
                    activeDot={{ r: 6 }}
                    name="Score %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* Topic Performance Chart */}
      {topicPerformance.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold">Performance by Topic</h3>
            <span className="text-xs text-muted-foreground">Drag sideways to see more topics</span>
          </div>
          <div
            ref={chartScrollRef}
            className="overflow-x-auto overscroll-x-contain cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleChartPointerDown}
            onPointerMove={handleChartPointerMove}
            onPointerUp={stopChartDrag}
            onPointerCancel={stopChartDrag}
            onPointerLeave={(event) => {
              if (dragStateRef.current.active) stopChartDrag(event);
            }}
          >
            <div style={{ width: topicChartWidth, height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicPerformance} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="topic"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={110}
                  />
                  <YAxis domain={[0, 12]} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="averageScore" fill="#8b5cf6" name="Average Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* Topic Details */}
      {topicPerformance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Topic Details</h3>
          <div className="space-y-3">
            {topicPerformance.map((topic: any, index: number) => {
              const topicData = topicProgressByName.get(String(topic.topic).toLowerCase());
              const rawDifficulty = topicData?.difficulty;
              const difficulty =
                rawDifficulty === "easy" || rawDifficulty === "hard" ? rawDifficulty : "medium";
              const difficultyColor = {
                easy: "bg-green-100 text-green-800",
                medium: "bg-yellow-100 text-yellow-800",
                hard: "bg-red-100 text-red-800",
              } satisfies Record<"easy" | "medium" | "hard", string>;
              const difficultyKey = difficulty as "easy" | "medium" | "hard";

              return (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-800">
                      {topic.topic}
                    </h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColor[difficultyKey]}`}>
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Attempts</p>
                      <p className="text-lg font-bold">{topic.attempts}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Avg Score</p>
                      <p className="text-lg font-bold">
                        {topic.averageScore.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Last Score</p>
                      <p className="text-lg font-bold">
                        {topicData?.lastScore || "-"}
                      </p>
                    </div>
                  </div>

                  {(topicData?.weakAreas?.length ?? 0) > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-red-700 mb-1">
                        Weak Areas:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {topicData?.weakAreas?.map((area: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(topicData?.strongAreas?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1">
                        Strong Areas:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {topicData?.strongAreas?.map((area: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Weak Topics for Revision */}
      {weakTopics.length > 0 && (
        <Card className="p-6 border-orange-200 bg-orange-50">
          <h3 className="text-lg font-bold mb-4 text-orange-900">
            Focus Areas (Score &lt; 50%)
          </h3>
          <div className="space-y-2">
            {weakTopics.map((topic, index) => (
              <div key={index} className="p-3 bg-white rounded border border-orange-200">
                <p className="font-semibold text-gray-800">{topic.topic}</p>
                <p className="text-sm text-gray-600">
                  Average Score: {topic.averageScore.toFixed(1)}/10
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-orange-800 mt-4">
            💡 We recommend focusing on these weak areas. Generate questions on
            these topics for targeted practice.
          </p>
        </Card>
      )}

      {progress && !topicPerformance.length && (
        <Card className="p-6 text-center">
          <p className="text-gray-600">
            No evaluation history yet. Start by generating and evaluating questions!
          </p>
        </Card>
      )}
    </div>
  );
}
