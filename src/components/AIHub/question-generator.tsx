import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Copy,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  Zap,
  XCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { FormattedAIText } from "@/components/AIHub/formatted-ai-text";
import {
  generateQuestionFn,
  getCategorizedTopicsFn,
  evaluateAnswerFn,
  getEvaluationProgressFn,
  getPendingQuestionFn,
  clearPendingQuestionFn,
} from "@/services/aihub.server";

interface TopicCategory {
  name: string;
  subtopics: string[];
  description?: string;
}

interface QuestionGeneratorProps {
  subject: string;
}

interface EvaluationProgress {
  status: "processing" | "switching" | "completed" | "error";
  message: string;
  notices: string[];
}

export function QuestionGenerator({ subject }: QuestionGeneratorProps) {
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [marks, setMarks] = useState<8 | 12>(8);
  const [questionType, setQuestionType] = useState<"theory" | "numerical" | "auto">("auto");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState<{
    text: string;
    type: string;
    topic?: string;
  } | null>(null);
  const [generationModelNotices, setGenerationModelNotices] = useState<string[]>([]);
  const [generatedTopic, setGeneratedTopic] = useState("");

  // Evaluation states
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [evaluationQuestionText, setEvaluationQuestionText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evaluationRequestId, setEvaluationRequestId] = useState("");
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null);

  // Fetch categories and pending question on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const result = await getCategorizedTopicsFn({ data: { subject } });
        if (!result.error && result.categories) {
          setCategories(result.categories);

          // Fetch pending question
          const pendingResult = await getPendingQuestionFn({ data: subject });
          if (!pendingResult.error && pendingResult.question) {
            const pending = pendingResult.question;
            setQuestion({
              text: pending.questionText,
              type: pending.questionType,
              topic: pending.topic,
            });
            setGeneratedTopic(pending.topic);
            setEvaluationQuestionText(pending.questionText);
            setMarks(pending.marks as 8 | 12);
            setSelectedTopic(pending.topic);

            // Set category from pending question topic
            const categoryForTopic = result.categories.find((cat) =>
              cat.subtopics.includes(pending.topic),
            );
            if (categoryForTopic) {
              setSelectedCategory(categoryForTopic.name);
            }
          }
        }
      } catch (err) {
        // Silent failure - categories/question not available
      }
    };

    if (subject) {
      fetchData();
    }
  }, [subject]);

  useEffect(() => {
    if (!evaluating || !evaluationRequestId) return;

    let cancelled = false;
    const loadProgress = async () => {
      try {
        const result = await getEvaluationProgressFn({
          data: { requestId: evaluationRequestId },
        });
        if (!cancelled && result.progress) {
          setEvaluationProgress(result.progress);
        }
      } catch {
        // Progress polling is best-effort; the evaluation request still owns the final result.
      }
    };

    loadProgress();
    const timer = window.setInterval(loadProgress, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [evaluating, evaluationRequestId]);

  const handleGenerateQuestion = async () => {
    if (!selectedCategory.trim()) {
      setError("Please select a subject category");
      return;
    }

    const topicForGeneration = selectedTopic.trim() || selectedCategory.trim();
    const autoSelectSubtopic = !selectedTopic.trim();

    setLoading(true);
    setError("");
    setEvaluation(null);
    setGenerationModelNotices([]);
    setEvaluationMode(false);
    setEvaluationQuestionText("");
    setGeneratedTopic("");
    setImageFile(null);
    setImagePreview("");
    setEvaluationError("");

    try {
      const data = await generateQuestionFn({
        data: {
          topic: topicForGeneration,
          categoryName: selectedCategory.trim(),
          candidateSubtopics: autoSelectSubtopic ? subtopics : [],
          marks,
          questionType,
          subject,
          customPrompt: customPrompt.trim(),
        },
      });

      if (data.error) {
        setError(data.error || "Failed to generate question");
        return;
      }

      setQuestion({
        text: data.question,
        type: data.type,
        topic: data.topic,
      });
      setGeneratedTopic(data.topic || selectedTopic.trim() || "");
      setEvaluationQuestionText(data.question);
      setGenerationModelNotices(data.modelNotices ?? []);
      setError("");
    } catch (err) {
      setError("Failed to generate question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuestion = async () => {
    if (!question) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(question.text);
        toast.success("Question copied to clipboard");
      } else {
        // Fallback for insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = question.text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast.success("Question copied to clipboard");
      }
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setEvaluationError("Please upload a JPG, PNG, or JPEG image");
      return;
    }

    setImageFile(file);
    setEvaluationError("");

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEvaluateAnswer = async () => {
    const questionForEvaluation = evaluationQuestionText.trim();

    if (!imageFile || !questionForEvaluation) {
      setEvaluationError("Please upload an image and provide the question to evaluate against");
      return;
    }

    setEvaluating(true);
    setEvaluationError("");
    setEvaluation(null);
    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEvaluationRequestId(requestId);
    setEvaluationProgress({
      status: "processing",
      message: "Uploading your answer image to the evaluator...",
      notices: [],
    });

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;

        try {
          const data = await evaluateAnswerFn({
            data: {
              imageUrl,
              questionText: questionForEvaluation,
              marks,
              topic: generatedTopic || selectedTopic.trim() || "Custom evaluation",
              subject,
              requestId,
            },
          });

          if (data.error) {
            setEvaluationError(data.error || "Failed to evaluate answer");
            setEvaluating(false);
            return;
          }

          setEvaluation(data);
          toast.success("Answer evaluated successfully");
          setEvaluationError("");

          // Clear the pending question and image after successful evaluation
          await clearPendingQuestionFn({ data: subject });
          setImageFile(null);
          setImagePreview("");
        } catch (err) {
          setEvaluationError("Failed to evaluate answer. Please try again.");
        } finally {
          setEvaluating(false);
        }
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      setEvaluationError("Failed to process image");
      setEvaluating(false);
    }
  };

  const selectedCategoryData = categories.find((cat) => cat.name === selectedCategory);
  const subtopics = selectedCategoryData?.subtopics || [];
  const wordLimit = marks === 8 ? 125 : 200;

  return (
    <div className="space-y-6">
      {/* Question Generation Section */}
      <Card className="p-6 dark:bg-slate-800">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">Generate Question</h2>

        {/* Category Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedTopic("");
              setGeneratedTopic("");
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            disabled={loading}
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topic Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Topic/Subtopic</label>
          <select
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              setGeneratedTopic("");
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            disabled={loading || !selectedCategory}
          >
            <option value="">Auto choose important subtopic...</option>
            {subtopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Leave this on auto to let AI choose the most important subtopic from the selected category.
          </p>
        </div>

        {/* Question Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Marks</label>
            <select
              value={marks}
              onChange={(e) => setMarks(parseInt(e.target.value) as 8 | 12)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              disabled={loading}
            >
              <option value={8}>8 Marks</option>
              <option value={12}>12 Marks</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Question Type</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as typeof questionType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              disabled={loading}
            >
              <option value="auto">Auto Detect</option>
              <option value="theory">Theory</option>
              <option value="numerical">Numerical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Word Limit</label>
            <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-slate-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{wordLimit} words</span>
            </div>
          </div>
        </div>

        {/* Custom Prompt */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Custom Instructions (Optional)
          </label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g., 'focus on practical examples', 'make it easier', 'include real-world application'"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tip: Add any special instructions for question generation</p>
        </div>

        {error && (
          <Alert className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 mb-4">
            <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="mb-4">
            <LoadingAnimation
              isVisible={loading}
              messages={[
                selectedTopic.trim()
                  ? "Reading the selected topic and marks..."
                  : "Reviewing all subtopics in the selected category...",
                "Building an exam-style question with the right difficulty...",
                selectedTopic.trim()
                  ? "Checking syllabus fit and wording clarity..."
                  : "Choosing the most important subtopic for your selected question type...",
                "Adding clean formatting so it is easy to copy and answer...",
              ]}
              variant="processing"
              interval={2500}
            />
          </div>
        )}

        <Button
          onClick={handleGenerateQuestion}
          disabled={loading || !selectedCategory.trim()}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Question"
          )}
        </Button>
      </Card>

      {/* Generated Question Display */}
      {question && (
        <Card className="p-6 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-1">[{marks} Marks]</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Maximum Answer Length: {wordLimit} Words</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Type: {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
              </p>
              {question.topic && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Topic: {question.topic}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyQuestion}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateQuestion}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {generationModelNotices.length > 0 && (
            <Alert className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-blue-800 dark:text-blue-300">
                {generationModelNotices[generationModelNotices.length - 1]}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-white rounded p-4 border border-blue-200 dark:bg-slate-800 dark:border-blue-700">
            <FormattedAIText className="prose max-w-none text-gray-800 dark:prose-invert dark:text-gray-100">
              {question.text}
            </FormattedAIText>
          </div>

          <div className="mt-4 p-4 bg-white dark:bg-slate-700 rounded border border-blue-200 dark:border-blue-700">
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Tips:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li>Read the question carefully and understand all parts</li>
              <li>Keep your answer concise and within the word limit</li>
              <li>Use proper diagrams or derivations where necessary</li>
              <li>Review your answer before uploading the image</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Answer Evaluation Section */}
      <Card className="p-6 border-green-200 bg-green-50 dark:bg-slate-800 dark:border-green-900">
        <div className="mb-6">
          <h3 className="text-xl font-bold mb-2 dark:text-white">Evaluate Your Answer</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Use the generated question, or paste any outside question and upload your answer image.
          </p>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Question Being Evaluated
            </label>
            <textarea
              value={evaluationQuestionText}
              onChange={(e) => {
                setEvaluationQuestionText(e.target.value);
                setEvaluation(null);
                setEvaluationError("");
              }}
              placeholder="Paste the question here, or generate one above to fill this automatically..."
              className="min-h-28 w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-green-700 dark:bg-slate-700 dark:text-white dark:focus:ring-green-900"
              disabled={evaluating}
            />
            {question && evaluationQuestionText !== question.text && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEvaluationQuestionText(question.text);
                  setEvaluation(null);
                  setEvaluationError("");
                }}
                disabled={evaluating}
              >
                Use Generated Question
              </Button>
            )}
          </div>
        </div>

        {/* Show upload form only when no evaluation results */}
        {!evaluation && (
          <div className="space-y-4">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Answer Image</label>
              <div className="border-2 border-dashed border-green-400 dark:border-green-600 rounded-lg p-8 text-center hover:border-green-500 dark:hover:border-green-500 hover:bg-green-100 dark:hover:bg-green-900/20 transition">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                  disabled={evaluating}
                />
                <label htmlFor="image-upload" className="cursor-pointer block">
                  <Upload className="mx-auto h-12 w-12 text-green-600 dark:text-green-500 mb-2" />
                  <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Click to upload
                  </p>
                  <p className="text-sm text-gray-500">JPG, PNG up to 10MB</p>
                </label>
              </div>
            </div>

            {/* Image Preview */}
            {imagePreview && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">Your Answer Preview:</p>
                <img
                  src={imagePreview}
                  alt="Answer preview"
                  className="max-h-80 w-full object-contain rounded border border-gray-200"
                />
              </div>
            )}

            {evaluationError && (
              <Alert className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-red-800 dark:text-red-300">{evaluationError}</AlertDescription>
              </Alert>
            )}

            {evaluating && (
              <div className="mb-4 space-y-3">
                <LoadingAnimation
                  isVisible={evaluating}
                  message={
                    evaluationProgress?.message ??
                    "Starting answer evaluation..."
                  }
                  variant={evaluationProgress?.status === "error" ? "error" : "processing"}
                />
              </div>
            )}

            <Button
              onClick={handleEvaluateAnswer}
              disabled={evaluating || !imageFile || !evaluationQuestionText.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {evaluating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating Your Answer...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Evaluate Answer
                </>
              )}
            </Button>
          </div>
        )}

        {/* Evaluation Results */}
        {evaluation && (
          <div className="mt-6 space-y-4 border-t border-green-200 dark:border-green-900 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border-l-4 border-green-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Score</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {evaluation.score}/{marks}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4 border-l-4 border-blue-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Percentage</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((evaluation.score / marks) * 100)}%
                </p>
              </div>
            </div>

            {evaluation.feedback && (
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4 space-y-3">
                {evaluation.feedback.missingConcepts?.length > 0 && (
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400 text-sm mb-2">
                      <XCircle className="h-4 w-4" />
                      Missing Concepts
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {evaluation.feedback.missingConcepts.map((concept: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2">-</span>
                          <FormattedAIText inline>{concept}</FormattedAIText>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.feedback.incorrectStatements?.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <p className="flex items-center gap-2 font-semibold text-orange-600 dark:text-orange-400 text-sm mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Incorrect Statements
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {evaluation.feedback.incorrectStatements.map(
                        (stmt: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">-</span>
                            <FormattedAIText inline>{stmt}</FormattedAIText>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {evaluation.feedback.areasToImprove?.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <p className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2">
                      <Lightbulb className="h-4 w-4" />
                      Areas to Improve
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {evaluation.feedback.areasToImprove.map((area: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <span className="mr-2">-</span>
                          <FormattedAIText inline>{area}</FormattedAIText>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evaluation.feedback.examWritingSuggestions?.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                    <p className="flex items-center gap-2 font-semibold text-purple-600 dark:text-purple-400 text-sm mb-2">
                      <FileText className="h-4 w-4" />
                      Exam Writing Tips
                    </p>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {evaluation.feedback.examWritingSuggestions.map(
                        (tip: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">-</span>
                            <FormattedAIText inline>{tip}</FormattedAIText>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {evaluation.modelAnswer && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-600 dark:border-blue-500">
                <p className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  <BookOpen className="h-4 w-4" />
                  Model Answer
                </p>
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                  <FormattedAIText>
                    {evaluation.modelAnswer}
                  </FormattedAIText>
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                setEvaluation(null);
                setImageFile(null);
                setImagePreview("");
                setEvaluationError("");
              }}
              disabled={evaluating}
              className="w-full mt-4"
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              Evaluate Another Answer
            </Button>
          </div>
        )}
      </Card>

    </div>
  );
}
