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
  X,
  ImagePlus,
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

interface QuestionChoice {
  question: string;
  type: string;
  topic?: string;
}

const MAX_EVALUATION_IMAGES = 2;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
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
  const [questionChoices, setQuestionChoices] = useState<QuestionChoice[]>([]);
  const [selectedQuestionChoiceIndex, setSelectedQuestionChoiceIndex] = useState(0);
  const [generationModelNotices, setGenerationModelNotices] = useState<string[]>([]);
  const [generatedTopic, setGeneratedTopic] = useState("");

  // Evaluation states
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [evaluationQuestionText, setEvaluationQuestionText] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evaluationRequestId, setEvaluationRequestId] = useState("");
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null);

  const applyPendingQuestion = (
    pending: any | null,
    categoryOptions: TopicCategory[] = categories,
  ) => {
    if (!pending) {
      setQuestion(null);
      setQuestionChoices([]);
      setSelectedQuestionChoiceIndex(0);
      setEvaluationQuestionText("");
      setGeneratedTopic("");
      return;
    }

    const pendingChoices =
      pending.choices?.length > 0
        ? pending.choices
        : [
            {
              question: pending.questionText,
              type: pending.questionType,
              topic: pending.topic,
            },
          ];
    const nextChoice = pendingChoices[0];
    if (!nextChoice) {
      setQuestion(null);
      setQuestionChoices([]);
      setSelectedQuestionChoiceIndex(0);
      setEvaluationQuestionText("");
      setGeneratedTopic("");
      return;
    }

    setQuestion({
      text: nextChoice.question,
      type: nextChoice.type,
      topic: nextChoice.topic,
    });
    setQuestionChoices(pendingChoices);
    setSelectedQuestionChoiceIndex(0);
    setGeneratedTopic(nextChoice.topic || "");
    setEvaluationQuestionText(nextChoice.question);
    setMarks(pending.marks as 8 | 12);
    setSelectedTopic(nextChoice.topic || "");

    const categoryForTopic = categoryOptions.find((cat) =>
      cat.subtopics.includes(nextChoice.topic),
    );
    if (categoryForTopic) {
      setSelectedCategory(categoryForTopic.name);
    }
  };

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
            applyPendingQuestion(pendingResult.question, result.categories);
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
    setQuestionChoices([]);
    setSelectedQuestionChoiceIndex(0);
    setGeneratedTopic("");
    setImageFiles([]);
    setImagePreviews([]);
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
      setQuestionChoices(data.choices ?? []);
      setSelectedQuestionChoiceIndex(0);
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

  const handleSelectQuestionChoice = (choice: QuestionChoice, index: number) => {
    setSelectedQuestionChoiceIndex(index);
    setQuestion({
      text: choice.question,
      type: choice.type,
      topic: choice.topic,
    });
    setGeneratedTopic(choice.topic || selectedTopic.trim() || "");
    setEvaluationQuestionText(choice.question);
    setEvaluation(null);
    setEvaluationError("");
  };

  const handleSwapQuestion = () => {
    if (questionChoices.length <= 1) return;

    const nextIndex = (selectedQuestionChoiceIndex + 1) % questionChoices.length;
    const nextChoice = questionChoices[nextIndex];
    if (nextChoice) {
      handleSelectQuestionChoice(nextChoice, nextIndex);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.some((file) => !["image/jpeg", "image/png", "image/jpg"].includes(file.type))) {
      setEvaluationError("Please upload a JPG, PNG, or JPEG image");
      e.target.value = "";
      return;
    }

    const remainingSlots = MAX_EVALUATION_IMAGES - imageFiles.length;
    if (remainingSlots <= 0) {
      setEvaluationError(`You can upload a maximum of ${MAX_EVALUATION_IMAGES} answer images`);
      e.target.value = "";
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setEvaluationError(`Only ${MAX_EVALUATION_IMAGES} answer images are allowed. Extra images were ignored.`);
    } else {
      setEvaluationError("");
    }

    try {
      const previews = await Promise.all(filesToAdd.map(readFileAsDataUrl));
      setImageFiles((current) => [...current, ...filesToAdd]);
      setImagePreviews((current) => [...current, ...previews]);
    } catch {
      setEvaluationError("Failed to process image");
    } finally {
      e.target.value = "";
    }
  };

  const removeEvaluationImage = (index: number) => {
    setImageFiles((current) => current.filter((_, i) => i !== index));
    setImagePreviews((current) => current.filter((_, i) => i !== index));
    setEvaluationError("");
  };

  const handleEvaluateAnswer = async () => {
  const questionForEvaluation = evaluationQuestionText.trim();

  if (imageFiles.length === 0 || !questionForEvaluation) {
    setEvaluationError(
      "Please upload at least one image and provide the question to evaluate against",
    );
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
    message: `Uploading your answer image${
      imageFiles.length > 1 ? "s" : ""
    } to the evaluator...`,
    notices: [],
  });

  try {
    const imageUrls = await Promise.all(
      imageFiles.map(readFileAsDataUrl),
    );

    const data = await evaluateAnswerFn({
      data: {
        imageUrl: imageUrls[0],
        imageUrls,
        questionText: questionForEvaluation,
        marks,
        topic: generatedTopic || selectedTopic.trim() || "Custom evaluation",
        subject,
        requestId,
      },
    });

    if (data.error) {
      setEvaluationError(data.error || "Failed to evaluate answer");
      return;
    }

    setEvaluation(data);
    toast.success("Answer evaluated successfully");
    setEvaluationError("");

    // DO NOT auto-switch to next question.
    // Keep current question visible while showing evaluation.

    setImageFiles([]);
    setImagePreviews([]);
  } catch (err) {
    setEvaluationError("Failed to evaluate answer. Please try again.");
  } finally {
    setEvaluating(false);
  }
};

  const handleEvaluateAnother = () => {
  if (evaluation?.pendingQuestion) {
    applyPendingQuestion(evaluation.pendingQuestion);
  }

  setEvaluation(null);
  setImageFiles([]);
  setImagePreviews([]);
  setEvaluationError("");
};

  const selectedCategoryData = categories.find((cat) => cat.name === selectedCategory);
  const subtopics = selectedCategoryData?.subtopics || [];
  const wordLimit = marks === 8 ? 125 : 200;
  const hasRemainingPendingQuestion = Boolean(evaluation?.pendingQuestion);
  const canAddMoreImages = imageFiles.length < MAX_EVALUATION_IMAGES;

  return (
    <div className="space-y-6">
      {/* Question Generation Section */}
      <Card className="ai-hub-panel rounded-xl p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="ai-hub-kicker">
              <Zap className="h-4 w-4" />
              Question engine
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Generate Question</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a syllabus area and let AI prepare a university-style practice question.
            </p>
          </div>
          <span className="ai-hub-pill w-fit text-xs">{wordLimit} word target</span>
        </div>

        {/* Category Selection */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedTopic("");
              setGeneratedTopic("");
            }}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm sm:text-base"
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
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Topic/Subtopic</label>
          <select
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              setGeneratedTopic("");
            }}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading || !selectedCategory}
          >
            <option value="">Auto choose important subtopic...</option>
            {subtopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Leave this on auto to let AI choose the most important subtopic from the selected category.
          </p>
        </div>

        {/* Question Settings */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Marks</label>
            <select
              value={marks}
              onChange={(e) => setMarks(parseInt(e.target.value) as 8 | 12)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm sm:text-base"
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
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm sm:text-base"
              disabled={loading}
            >
              <option value="auto">Auto Detect</option>
              <option value="theory">Theory</option>
              <option value="numerical">Numerical</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Word Limit</label>
            <div className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-slate-700 flex items-center h-[42px] sm:h-[44px]">
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
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Tip: Add any special instructions for question generation</p>
        </div>

        {error && (
          <Alert className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 mb-4">
            <AlertCircle className="w-4 h-4" />
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
          className="ai-hub-primary-button w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate Question
            </>
          )}
        </Button>
      </Card>

      {/* Generated Question Display */}
      {question && (
        <Card className="ai-hub-panel rounded-xl p-4 sm:p-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="ai-hub-kicker">
                <Lightbulb className="h-4 w-4" />
                Generated prompt
              </p>
              <h3 className="text-lg font-bold text-foreground">[{marks} Marks]</h3>
              <p className="text-sm text-muted-foreground">Maximum Answer Length: {wordLimit} Words</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="ai-hub-pill px-2 py-1">Type: {question.type.charAt(0).toUpperCase() + question.type.slice(1)}</span>
                {question.topic && <span>Topic: {question.topic}</span>}
              </div>
            </div>
            <div className="flex gap-2 self-start">
              <Button variant="outline" size="sm" onClick={handleCopyQuestion}>
                <Copy className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Copy</span>
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

          <div className="rounded-lg border border-primary/20 bg-background/70 p-3 shadow-inner sm:p-4">
            <FormattedAIText className="prose prose-sm sm:prose-base max-w-none text-gray-800 dark:prose-invert dark:text-gray-100">
              {question.text}
            </FormattedAIText>
          </div>

          {questionChoices.length > 1 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Question {selectedQuestionChoiceIndex + 1} of {questionChoices.length} - saved until answered
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwapQuestion}
                disabled={evaluating}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Swap Question
              </Button>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-border bg-background/55 p-3 sm:p-4">
            <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2 text-sm">Tips:</h4>
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
      <Card className="ai-hub-panel rounded-xl p-4 sm:p-6">
        <div className="mb-6">
          <p className="ai-hub-kicker">
            <CheckCircle2 className="h-4 w-4" />
            Answer evaluator
          </p>
          <h3 className="mt-2 text-lg font-bold tracking-tight sm:text-xl">Evaluate Your Answer</h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Use the generated question, or paste any outside question and upload up to {MAX_EVALUATION_IMAGES} answer images.
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
              className="min-h-28 w-full rounded-md border border-primary/25 bg-background/80 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Answer Image{MAX_EVALUATION_IMAGES > 1 ? "s" : ""}
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {imageFiles.length}/{MAX_EVALUATION_IMAGES} uploaded
                </span>
              </div>

              {/* Image previews grid */}
              {imagePreviews.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm"
                    >
                      <img
                        src={preview}
                        alt={`Answer page ${index + 1}`}
                        className="h-32 w-full bg-muted/45 object-contain sm:h-40"
                      />
                      <div className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                        Page {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvaluationImage(index)}
                        disabled={evaluating}
                        aria-label={`Remove page ${index + 1}`}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload dropzone - only shown if more slots remain */}
              {canAddMoreImages && (
                <div className="ai-hub-upload-zone rounded-lg p-6 text-center sm:p-8">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                    disabled={evaluating}
                    multiple
                  />
                  <label htmlFor="image-upload" className="cursor-pointer block">
                    {imageFiles.length === 0 ? (
                      <Upload className="mx-auto mb-2 h-10 w-10 text-primary sm:h-12 sm:w-12" />
                    ) : (
                      <ImagePlus className="mx-auto mb-2 h-10 w-10 text-primary sm:h-12 sm:w-12" />
                    )}
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1 text-sm sm:text-base">
                      {imageFiles.length === 0 ? "Click to upload" : "Add another page"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      JPG, PNG up to 10MB · up to {MAX_EVALUATION_IMAGES} page{MAX_EVALUATION_IMAGES > 1 ? "s" : ""}
                    </p>
                  </label>
                </div>
              )}
            </div>

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
              disabled={evaluating || imageFiles.length === 0 || !evaluationQuestionText.trim()}
              className="ai-hub-primary-button w-full"
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
          <div className="mt-6 space-y-4 border-t border-border pt-6">
            {hasRemainingPendingQuestion && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  One generated question is still pending. Use the button below to upload an answer for it.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-lg border border-border bg-background/65 p-4 shadow-sm">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Score</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                  {evaluation.score}/{marks}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/65 p-4 shadow-sm">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Percentage</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((evaluation.score / marks) * 100)}%
                </p>
              </div>
            </div>

            {evaluation.feedback && (
              <div className="space-y-3 rounded-lg border border-border bg-background/65 p-4">
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
                    <p className="flex items-center gap-2 font-semibold text-cyan-600 dark:text-cyan-300 text-sm mb-2">
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
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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
              onClick={handleEvaluateAnother}
              disabled={evaluating}
              className="w-full mt-4"
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              {hasRemainingPendingQuestion ? "Answer Remaining Question" : "Evaluate Another Answer"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
