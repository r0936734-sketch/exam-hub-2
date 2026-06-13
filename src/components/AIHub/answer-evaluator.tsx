import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { evaluateAnswerFn, getEvaluationProgressFn } from "@/services/aihub.server";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { FormattedAIText } from "@/components/AIHub/formatted-ai-text";

interface AnswerEvaluatorProps {
  subject: string;
}

interface EvaluationProgress {
  status: "processing" | "switching" | "completed" | "error";
  message: string;
  notices: string[];
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

export function AnswerEvaluator({ subject }: AnswerEvaluatorProps) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [marks, setMarks] = useState<8 | 12>(8);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evaluationRequestId, setEvaluationRequestId] = useState("");
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null);

  useEffect(() => {
    if (!loading || !evaluationRequestId) return;

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
        // Progress is best-effort; the main evaluation request still controls success/failure.
      }
    };

    loadProgress();
    const timer = window.setInterval(loadProgress, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loading, evaluationRequestId]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.some((file) => !["image/jpeg", "image/png", "image/jpg"].includes(file.type))) {
      setError("Please upload a JPG, PNG, or JPEG image");
      e.target.value = "";
      return;
    }

    const remainingSlots = MAX_EVALUATION_IMAGES - imageFiles.length;
    if (remainingSlots <= 0) {
      setError(`You can upload a maximum of ${MAX_EVALUATION_IMAGES} answer images`);
      e.target.value = "";
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setError(`Only ${MAX_EVALUATION_IMAGES} answer images are allowed. Extra images were ignored.`);
    } else {
      setError("");
    }

    try {
      const previews = await Promise.all(filesToAdd.map(readFileAsDataUrl));
      setImageFiles((current) => [...current, ...filesToAdd]);
      setImagePreviews((current) => [...current, ...previews]);
    } catch {
      setError("Failed to process image");
    } finally {
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((current) => current.filter((_, i) => i !== index));
    setImagePreviews((current) => current.filter((_, i) => i !== index));
    setError("");
  };

  const handleEvaluate = async () => {
    if (imageFiles.length === 0 || !questionText.trim() || !topic.trim()) {
      setError("Please provide at least one image, question, and topic");
      return;
    }

    setLoading(true);
    setError("");
    setEvaluation(null);
    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEvaluationRequestId(requestId);
    setEvaluationProgress({
      status: "processing",
      message: `Uploading your answer image${imageFiles.length > 1 ? "s" : ""} to the evaluator...`,
      notices: [],
    });

    try {
      const imageUrls = await Promise.all(imageFiles.map(readFileAsDataUrl));
      const data = await evaluateAnswerFn({
        data: {
          imageUrl: imageUrls[0],
          imageUrls,
          questionText: questionText.trim(),
          marks,
          topic: topic.trim(),
          subject,
          requestId,
        },
      });

      if (data.error) {
        setError(data.error || "Failed to evaluate answer");
        return;
      }

      setEvaluation(data);
      toast.success("Answer evaluated successfully");
      setError("");
    } catch (err) {
      setError("Failed to evaluate answer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const wordLimit = marks === 8 ? 125 : 200;

  return (
    <div className="space-y-6">
      <Card className="ai-hub-panel rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <p className="ai-hub-kicker">
            <Sparkles className="h-4 w-4" />
            Answer evaluator
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Evaluate Your Answer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload one or two answer images and get structured examiner feedback.
          </p>
        </div>

        <div className="space-y-4">
          {/* Question Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question (for reference)
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Paste the question here..."
              className="h-20 w-full rounded-md border border-primary/25 bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Topic Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Normalization"
                className="w-full rounded-md border border-primary/25 bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={loading}
              />
            </div>

            {/* Marks Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Marks</label>
              <select
                value={marks}
                onChange={(e) => setMarks(parseInt(e.target.value) as 8 | 12)}
                className="w-full rounded-md border border-primary/25 bg-background/80 px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={loading}
              >
                <option value={8}>8 Marks</option>
                <option value={12}>12 Marks</option>
              </select>
            </div>

            {/* Word Limit Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Word Limit
              </label>
              <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                <span className="text-sm font-semibold">{wordLimit} words</span>
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">
                Handwritten Answer Images
              </label>
              <span className="text-xs text-muted-foreground">
                {imageFiles.length}/{MAX_EVALUATION_IMAGES} uploaded
              </span>
            </div>
            <div className="ai-hub-upload-zone rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                multiple
                onChange={handleImageSelect}
                disabled={loading || imageFiles.length >= MAX_EVALUATION_IMAGES}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {imageFiles.length === 0 ? (
                  <Upload className="h-7 w-7 text-primary" />
                ) : (
                  <ImagePlus className="h-7 w-7 text-primary" />
                )}
                <span className="text-sm text-gray-600">Click to upload or add one more image</span>
                <span className="text-xs text-gray-500">JPG, PNG, JPEG (max {MAX_EVALUATION_IMAGES} images)</span>
              </label>
            </div>

            {imagePreviews.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {imagePreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="relative overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm">
                    <img
                      src={preview}
                      alt={`Answer preview ${index + 1}`}
                      className="h-52 w-full bg-muted/45 object-contain"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeImage(index)}
                      disabled={loading}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute right-2 top-2 h-8 w-8 bg-background/85"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="space-y-3">
              <LoadingAnimation
                isVisible={loading}
                message={
                  evaluationProgress?.message ??
                  "Starting answer evaluation..."
                }
                variant={evaluationProgress?.status === "error" ? "error" : "processing"}
              />
            </div>
          )}

          <Button
            onClick={handleEvaluate}
            disabled={loading || imageFiles.length === 0 || !questionText.trim()}
            className="ai-hub-primary-button w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Evaluate Answer
              </>
            )}
          </Button>
        </div>
      </Card>

      {evaluation && (
        <div className="space-y-4">
          {/* Score Card */}
          <Card className="p-6 border-green-200 bg-green-50">
            <div className="text-center mb-4">
              <h3 className="text-4xl font-bold text-green-700">
                {evaluation.score} / {evaluation.maxMarks}
              </h3>
              <p className="text-sm text-green-600 mt-1">
                ({((evaluation.score / evaluation.maxMarks) * 100).toFixed(1)}%)
              </p>
            </div>
          </Card>

          {/* Feedback Sections */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Detailed Feedback</h3>

            <div className="space-y-4">
              {evaluation.feedback.missingConcepts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Missing Concepts</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.feedback.missingConcepts.map((concept: string, i: number) => (
                      <li key={i} className="text-gray-700">
                        <FormattedAIText inline>{concept}</FormattedAIText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.feedback.incorrectStatements.length > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-700 mb-2">Incorrect Statements</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.feedback.incorrectStatements.map((stmt: string, i: number) => (
                      <li key={i} className="text-gray-700">
                        <FormattedAIText inline>{stmt}</FormattedAIText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.feedback.areasToImprove.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2">Areas to Improve</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.feedback.areasToImprove.map((area: string, i: number) => (
                      <li key={i} className="text-gray-700">
                        <FormattedAIText inline>{area}</FormattedAIText>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.feedback.examWritingSuggestions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-cyan-700 mb-2">Exam Writing Suggestions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {evaluation.feedback.examWritingSuggestions.map(
                      (suggestion: string, i: number) => (
                        <li key={i} className="text-gray-700">
                          <FormattedAIText inline>{suggestion}</FormattedAIText>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {/* Model Answer */}
          <Card className="p-6 border-blue-200 bg-blue-50">
            <h3 className="font-bold text-lg mb-3 text-blue-900">Model Answer (Reference)</h3>
            <div className="bg-white rounded p-4 border border-blue-200">
              <FormattedAIText className="text-gray-800">{evaluation.modelAnswer}</FormattedAIText>
            </div>
          </Card>

          {/* OCR Text */}
          <Card className="p-6 border-gray-200">
            <h3 className="font-bold text-lg mb-3">Extracted Text (OCR)</h3>
            <div className="bg-gray-50 rounded p-4 border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{evaluation.ocrText}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
