import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
}

export function ProgressDashboard({ subject }: ProgressDashboardProps) {
  const [progress, setProgress] = useState<any | null>(null);
  const [weakTopics, setWeakTopics] = useState<TopicProgress[]>([]);
  const [evaluationHistory, setEvaluationHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // Prepare chart data from evaluation history
  const chartData = (evaluationHistory || []).map((evaluation: any) => ({
    date: new Date(evaluation.evaluatedAt).toLocaleDateString(),
    score: evaluation.score,
    maxMarks: evaluation.maxMarks,
    percentage: ((evaluation.score / evaluation.maxMarks) * 100).toFixed(0),
  }));

  // Get topic performance data
  const topicPerformance = (progress?.topicProgress || []).map((data: any) => ({
    topic: data.topic,
    averageScore: data.lastScore || 0,
    attempts: data.attempts || 0,
  }));

  // Calculate stats properly
  const totalAttempts = progress?.overallAttempts || 0;
  const topicsCovered = topicPerformance.length;
  const weakTopicsCount = (progress?.topicProgress || []).filter(
    (tp: any) => tp.lastScore && (tp.lastScore / 12) * 100 < 50
  ).length;

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

      {/* Score Trend Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Score Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                formatter={(value) => `${value}%`}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="percentage"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
                name="Score %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Topic Performance Chart */}
      {topicPerformance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Performance by Topic</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topicPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="topic" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="averageScore" fill="#8b5cf6" name="Average Score" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Topic Details */}
      {topicPerformance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Topic Details</h3>
          <div className="space-y-3">
            {topicPerformance.map((topic: any, index: number) => {
              const topicData = progress?.topicProgress?.[topic.topic];
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

                  {topicData?.weakAreas?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-red-700 mb-1">
                        Weak Areas:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {topicData.weakAreas.map((area: string, i: number) => (
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

                  {topicData?.strongAreas?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1">
                        Strong Areas:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {topicData.strongAreas.map((area: string, i: number) => (
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
