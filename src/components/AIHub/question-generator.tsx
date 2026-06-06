import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
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
import { Loader2, Copy, RefreshCw, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateQuestionFn,
  getCategorizedTopicsFn,
  evaluateAnswerFn,
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
  } | null>(null);

  // Evaluation states
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluation, setEvaluation] = useState<any | null>(null);

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
            });
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

  const handleGenerateQuestion = async () => {
    if (!selectedTopic.trim()) {
      setError("Please select a topic");
      return;
    }

    setLoading(true);
    setError("");
    setEvaluation(null);
    setEvaluationMode(false);
    setImageFile(null);
    setImagePreview("");
    setEvaluationError("");

    try {
      const data = await generateQuestionFn({
        data: {
          topic: selectedTopic.trim(),
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
      });
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
    if (!imageFile || !question) {
      setEvaluationError("Please upload an image and generate a question first");
      return;
    }

    setEvaluating(true);
    setEvaluationError("");

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;

        try {
          const data = await evaluateAnswerFn({
            data: {
              imageUrl,
              questionText: question.text,
              marks,
              topic: selectedTopic.trim(),
              subject,
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
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            disabled={loading || !selectedCategory}
          >
            <option value="">Select a topic...</option>
            {subtopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
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

        <Button
          onClick={handleGenerateQuestion}
          disabled={loading || !selectedTopic.trim()}
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

          <div className="bg-white rounded p-4 border border-blue-200 dark:bg-slate-800 dark:border-blue-700">
            <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-100">
              <ReactMarkdown
                components={{
                  p: ({ node, ...props }) => <p className="leading-relaxed mb-3" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-bold text-gray-900 dark:text-gray-50" {...props} />,
                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="text-gray-700 dark:text-gray-300" {...props} />,
                  code: ({ node, ...props }) => <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-900 dark:text-gray-100 font-mono" {...props} />,
                  pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto mb-3" {...props} />,
                }}
              >
                {question.text}
              </ReactMarkdown>
            </div>
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
      {question && (
        <Card className="p-6 border-green-200 bg-green-50 dark:bg-slate-800 dark:border-green-900">
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-2 dark:text-white">Upload Your Answer</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Write your answer to the question above. Take a clear photo and upload it below for
              instant evaluation.
            </p>
            {/* Question Reference */}
            <div className="p-3 bg-white dark:bg-slate-700 rounded border-l-4 border-blue-500 dark:border-blue-600 mb-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Question Being Evaluated:
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{question.text}</p>
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
                    <svg
                      className="mx-auto h-12 w-12 text-green-600 dark:text-green-500 mb-2"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-8-12l-4-4m0 0l-4 4m4-4v12"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Click to upload or drag and drop
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

              <Button
                onClick={handleEvaluateAnswer}
                disabled={evaluating || !imageFile}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Evaluating Your Answer Against This Question...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Evaluate Answer (Auto-Checking Against Question)
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
                      <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-2">
                        ❌ Missing Concepts:
                      </p>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {evaluation.feedback.missingConcepts.map((concept: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span><ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{concept}</ReactMarkdown></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.feedback.incorrectStatements?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="font-semibold text-orange-600 dark:text-orange-400 text-sm mb-2">
                        ⚠️ Incorrect Statements:
                      </p>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {evaluation.feedback.incorrectStatements.map(
                          (stmt: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span><ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{stmt}</ReactMarkdown></span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {evaluation.feedback.areasToImprove?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm mb-2">
                        💡 Areas to Improve:
                      </p>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {evaluation.feedback.areasToImprove.map((area: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span><ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{area}</ReactMarkdown></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.feedback.examWritingSuggestions?.length > 0 && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <p className="font-semibold text-purple-600 dark:text-purple-400 text-sm mb-2">
                        📝 Exam Writing Tips:
                      </p>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {evaluation.feedback.examWritingSuggestions.map(
                          (tip: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span><ReactMarkdown components={{ p: ({node, ...props}) => <span {...props} /> }}>{tip}</ReactMarkdown></span>
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
                  <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">📚 Model Answer:</p>
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }: any) => <p className="mb-2" {...props} />,
                        strong: ({ node, ...props }: any) => (
                          <strong className="font-bold text-gray-900 dark:text-gray-100" {...props} />
                        ),
                        em: ({ node, ...props }: any) => (
                          <em className="italic text-gray-800 dark:text-gray-200" {...props} />
                        ),
                        ul: ({ node, ...props }: any) => (
                          <ul className="list-disc list-inside mb-2 ml-2" {...props} />
                        ),
                        ol: ({ node, ...props }: any) => (
                          <ol className="list-decimal list-inside mb-2 ml-2" {...props} />
                        ),
                        li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
                        code: ({ node, ...props }: any) => (
                          <code
                            className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono text-gray-900 dark:text-gray-100"
                            {...props}
                          />
                        ),
                        pre: ({ node, ...props }: any) => (
                          <pre
                            className="bg-gray-100 dark:bg-gray-800 p-3 rounded mb-2 overflow-x-auto text-gray-900 dark:text-gray-100"
                            {...props}
                          />
                        ),
                        blockquote: ({ node, ...props }: any) => (
                          <blockquote
                            className="border-l-4 border-blue-400 dark:border-blue-500 pl-3 italic text-gray-700 dark:text-gray-300 mb-2"
                            {...props}
                          />
                        ),
                        h1: ({ node, ...props }: any) => (
                          <h1 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />
                        ),
                        h2: ({ node, ...props }: any) => (
                          <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />
                        ),
                        h3: ({ node, ...props }: any) => (
                          <h3 className="text-sm font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />
                        ),
                      }}
                    >
                      {evaluation.modelAnswer}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <Button
                onClick={handleGenerateQuestion}
                disabled={loading}
                className="w-full mt-4"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Another Question
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
