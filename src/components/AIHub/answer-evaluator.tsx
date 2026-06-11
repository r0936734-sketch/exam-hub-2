import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { evaluateAnswerFn } from "@/services/aihub.server";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { FormattedAIText } from "@/components/AIHub/formatted-ai-text";

interface AnswerEvaluatorProps {
  subject: string;
}

export function AnswerEvaluator({ subject }: AnswerEvaluatorProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [questionText, setQuestionText] = useState("");
  const [marks, setMarks] = useState<8 | 12>(8);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<any | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Please upload a JPG, PNG, or JPEG image");
      return;
    }

    setImageFile(file);
    setError("");

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEvaluate = async () => {
    if (!imageFile || !questionText.trim() || !topic.trim()) {
      setError("Please provide image, question, and topic");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;

        try {
          const data = await evaluateAnswerFn({
            data: {
              imageUrl,
              questionText: questionText.trim(),
              marks,
              topic: topic.trim(),
              subject,
            },
          });

          if (data.error) {
            setError(data.error || "Failed to evaluate answer");
            setLoading(false);
            return;
          }

          setEvaluation(data);
          data.modelNotices?.forEach((notice: string) => toast.info(notice));
          toast.success("Answer evaluated successfully");
          setError("");
        } catch (err) {
          setError("Failed to evaluate answer. Please try again.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      setError("Failed to process image");
      setLoading(false);
    }
  };

  const wordLimit = marks === 8 ? 125 : 200;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Evaluate Your Answer</h2>

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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 h-20"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>

            {/* Marks Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Marks</label>
              <select
                value={marks}
                onChange={(e) => setMarks(parseInt(e.target.value) as 8 | 12)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <span className="text-sm font-semibold">{wordLimit} words</span>
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Handwritten Answer Image
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleImageSelect}
                disabled={loading}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-600">Click to upload or drag and drop</span>
                <span className="text-xs text-gray-500">JPG, PNG, JPEG (max 5MB)</span>
              </label>
            </div>

            {imagePreview && (
              <div className="mt-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-md max-h-96 rounded border border-gray-200"
                />
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
            <LoadingAnimation
              isVisible={loading}
              messages={[
                "Reading your answer image and extracting the important parts...",
                "This can take around 2 minutes. Take a quick water break.",
                "Comparing your answer with the question and marking scheme...",
                "If the first AI model is busy, we will switch to another model automatically...",
                "Checking missing concepts, incorrect logic, and exam presentation...",
                "Still working. A fallback model may be preparing your evaluation now...",
                "Preparing clear feedback and a formatted model answer...",
              ]}
              variant="processing"
              interval={3500}
            />
          )}

          <Button
            onClick={handleEvaluate}
            disabled={loading || !imageFile || !questionText.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              "Evaluate Answer"
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
                  <h4 className="font-semibold text-purple-700 mb-2">Exam Writing Suggestions</h4>
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
