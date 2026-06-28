/**
 * ques-pdf.tsx
 * AI Hub — Question PDF Export Feature
 *
 * Drop-in component for the question generator UI.
 * Zero external dependencies beyond what the existing app already ships.
 *
 * Integration in 3 lines:
 *   import { SaveToPDFQueueButton, PDFQueuePanel } from "@/components/ques-pdf";
 *   <SaveToPDFQueueButton question={currentQuestion} />   // next to the generated question
 *   <PDFQueuePanel />                                     // anywhere on the page / sidebar
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { jsPDF } from "jspdf";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Layers,
  Loader2,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// 1.  DATA TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors the fields already present in the question-generator flow. */
export interface GeneratedQuestion {
  /** Unique id — can come from your generator or be generated here. */
  id?: string;
  questionText: string;
  marks: number;
  /** Leaf-level subtopic (most specific). */
  subtopic: string;
  /** Parent topic / chapter. */
  topic: string;
  /** e.g. "MCQ" | "Short Answer" | "Long Answer" | "Fill in the Blank" */
  type: string;
  subject: string;
  /** Optional provenance label, e.g. "CBSE 2023 Paper 1" */
  sourceLabel?: string;
}

interface QueuedQuestion extends GeneratedQuestion {
  id: string; // always present after enqueueing
  savedAt: string; // ISO string
  queueIndex: number; // 1-based display number
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "aihub_pdf_question_queue_v1";
const MAX_QUESTIONS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// 3.  LOCAL-STORAGE PERSISTENCE  (acts as the local DB-backed queue)
// ─────────────────────────────────────────────────────────────────────────────

function loadQueue(): QueuedQuestion[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedQuestion[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedQuestion[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage quota — silently ignore; UI will still work in-memory.
  }
}

function uid(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  CONTEXT + HOOK
// ─────────────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface PDFQueueContextValue {
  queue: QueuedQuestion[];
  enqueue: (q: GeneratedQuestion) => { ok: boolean; reason?: string };
  dequeue: (id: string) => void;
  updateQuestion: (id: string, updates: Partial<GeneratedQuestion>) => void;
  clearQueue: () => void;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const PDFQueueContext = createContext<PDFQueueContextValue | null>(null);

/** Wrap your app (or page) with this provider once. */
export function PDFQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedQuestion[]>(() => loadQueue());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Sync to localStorage whenever queue changes.
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const pushToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = uid();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        5000
      );
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const enqueue = useCallback(
    (q: GeneratedQuestion): { ok: boolean; reason?: string } => {
      if (queue.length >= MAX_QUESTIONS) {
        pushToast(
          "Question set limit reached. Export the current PDF and delete existing questions to start a new 10-question set.",
          "warning"
        );
        return { ok: false, reason: "limit_reached" };
      }

      const item: QueuedQuestion = {
        ...q,
        id: q.id ?? uid(),
        savedAt: new Date().toISOString(),
        queueIndex: queue.length + 1,
      };

      setQueue((prev) => {
        const next = [...prev, item];
        if (next.length === MAX_QUESTIONS) {
          pushToast(
            "Question set limit reached. Export the current PDF and delete existing questions to start a new 10-question set.",
            "warning"
          );
        } else {
          pushToast(`Question ${item.queueIndex} saved to PDF queue.`, "success");
        }
        return next;
      });

      return { ok: true };
    },
    [queue, pushToast]
  );

  const dequeue = useCallback((id: string) => {
    setQueue((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      // Re-number sequentially after deletion.
      return filtered.map((q, i) => ({ ...q, queueIndex: i + 1 }));
    });
  }, []);

  const updateQuestion = useCallback(
    (id: string, updates: Partial<GeneratedQuestion>) => {
      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );
    },
    []
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return (
    <PDFQueueContext.Provider
      value={{ queue, enqueue, dequeue, updateQuestion, clearQueue, toasts, dismissToast }}
    >
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </PDFQueueContext.Provider>
  );
}

export function usePDFQueue(): PDFQueueContextValue {
  const ctx = useContext(PDFQueueContext);
  if (!ctx) {
    throw new Error("usePDFQueue must be used within a <PDFQueueProvider>.");
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  TOAST STACK  (self-contained, zero dependency)
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-300",
    icon: <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    icon: <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    icon: <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />,
  },
};

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const style = TOAST_COLORS[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${style.bg} ${style.border}`}
          >
            {style.icon}
            <p className="flex-1 text-sm font-medium text-gray-800 leading-snug">
              {t.message}
            </p>
            <button
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-gray-400 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  SAVE BUTTON  (attach next to generated question output)
// ─────────────────────────────────────────────────────────────────────────────

interface SaveToPDFQueueButtonProps {
  question: GeneratedQuestion | null | undefined;
  /** Override button label. Default: "Save to PDF Queue" */
  label?: string;
  /** Extra Tailwind classes forwarded to the button root. */
  className?: string;
}

export function SaveToPDFQueueButton({
  question,
  label = "Save to PDF Queue",
  className = "",
}: SaveToPDFQueueButtonProps) {
  const { enqueue, queue } = usePDFQueue();
  const [flash, setFlash] = useState(false);

  const atLimit = queue.length >= MAX_QUESTIONS;

  const handleSave = () => {
    if (!question) return;
    const result = enqueue(question);
    if (result.ok) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={!question || atLimit}
      aria-label={
        atLimit
          ? "PDF queue is full — export before adding more questions"
          : "Save this question to the PDF export queue"
      }
      className={[
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        atLimit
          ? "cursor-not-allowed bg-gray-100 text-gray-400 border border-gray-200"
          : flash
          ? "bg-emerald-600 text-white border border-emerald-700 focus-visible:ring-emerald-500 scale-95"
          : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white border border-indigo-700 focus-visible:ring-indigo-500",
        className,
      ].join(" ")}
    >
      {flash ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {flash ? "Saved!" : label}
      {!atLimit && queue.length > 0 && (
        <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-bold">
          {queue.length}/{MAX_QUESTIONS}
        </span>
      )}
      {atLimit && (
        <span className="ml-1 rounded-full bg-red-200 text-red-700 px-1.5 py-0.5 text-xs font-bold">
          FULL
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  QUESTION CARD  (preview list item)
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  MCQ: "bg-violet-100 text-violet-700 border-violet-200",
  "Short Answer": "bg-sky-100 text-sky-700 border-sky-200",
  "Long Answer": "bg-orange-100 text-orange-700 border-orange-200",
  "Fill in the Blank": "bg-teal-100 text-teal-700 border-teal-200",
  "True/False": "bg-pink-100 text-pink-700 border-pink-200",
  Descriptive: "bg-amber-100 text-amber-700 border-amber-200",
};

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function QuestionCard({
  question,
  onDelete,
}: {
  question: QueuedQuestion;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated =
    question.questionText.length > 160 && !expanded;
  const displayText = truncated
    ? question.questionText.slice(0, 160) + "…"
    : question.questionText;

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Question number badge */}
        <span
          aria-label={`Question ${question.queueIndex}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white"
        >
          {question.queueIndex}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-relaxed">
            {displayText}
          </p>
          {question.questionText.length > 160 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}

          {/* Meta chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Type */}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${typeColor(question.type)}`}
            >
              <Layers className="h-3 w-3" aria-hidden />
              {question.type}
            </span>

            {/* Marks */}
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
              <BookOpen className="h-3 w-3" aria-hidden />
              {question.marks} {question.marks === 1 ? "mark" : "marks"}
            </span>

            {/* Subtopic */}
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              <Tag className="h-3 w-3" aria-hidden />
              {question.subtopic}
            </span>

            {/* Source (optional) */}
            {question.sourceLabel && (
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                {question.sourceLabel}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          aria-label={`Delete question ${question.queueIndex}`}
          className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.  EDITABLE PDF PREVIEW  (live editing before export)
// ─────────────────────────────────────────────────────────────────────────────

function EditableQuestionPreview({
  question,
  onUpdate,
}: {
  question: QueuedQuestion;
  onUpdate: (updates: Partial<GeneratedQuestion>) => void;
}) {
  const previewText = question.questionText.trim() || "Type your question here";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Question {question.queueIndex}
          </p>
          <p className="text-xs text-gray-500">Edits update the PDF preview instantly</p>
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
          Live preview
        </span>
      </div>

      <label className="mb-3 block text-xs font-medium text-gray-700">
        <span className="mb-1 block">Question text</span>
        <textarea
          value={question.questionText}
          onChange={(event) => onUpdate({ questionText: event.target.value })}
          rows={3}
          className="min-h-[84px] w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Subtopic</span>
          <input
            value={question.subtopic}
            onChange={(event) => onUpdate({ subtopic: event.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Topic</span>
          <input
            value={question.topic}
            onChange={(event) => onUpdate({ topic: event.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Type</span>
          <input
            value={question.type}
            onChange={(event) => onUpdate({ type: event.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Marks</span>
          <input
            type="number"
            min="0"
            value={question.marks}
            onChange={(event) =>
              onUpdate({ marks: Number(event.target.value) || 0 })
            }
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Subject</span>
          <input
            value={question.subject}
            onChange={(event) => onUpdate({ subject: event.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>

        <label className="block text-xs font-medium text-gray-700">
          <span className="mb-1 block">Source</span>
          <input
            value={question.sourceLabel ?? ""}
            onChange={(event) => onUpdate({ sourceLabel: event.target.value })}
            placeholder="e.g. CBSE 2023 Paper 1"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          PDF preview snippet
        </p>
        <p className="mt-1 text-sm font-medium text-gray-800">{previewText}</p>
        <p className="mt-2 text-xs text-gray-500">
          {question.subtopic} • {question.type} • {question.marks} mark{question.marks === 1 ? "" : "s"}
          {question.sourceLabel ? ` • ${question.sourceLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

function triggerPDFExport(questions: QueuedQuestion[]) {
  if (typeof window === "undefined") return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginY = 48;
  const contentWidth = pageWidth - marginX * 2;

  const subject = questions[0]?.subject ?? "General";
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);

  const footerText = "Generated by AI Hub: https://exam-hub-2-oedg.onrender.com/aihub";
  const footerUrl = "https://exam-hub-2-oedg.onrender.com/aihub";

  const drawHeader = () => {
    doc.setFillColor(27, 42, 94);
    doc.rect(0, 0, pageWidth, 92, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("LT Grade Mains", marginX, 36);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Subject: ${subject}`, marginX, 60);
    doc.text(`Generated on ${dateStr}`, pageWidth - marginX - 140, 60);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(
      `Total Questions: ${questions.length}   |   Total Marks: ${totalMarks}   |   AI Hub Generated Practice Paper`,
      marginX,
      108,
    );
  };

  const drawFooter = () => {
    const footerY = pageHeight - 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    if (typeof doc.textWithLink === "function") {
      doc.textWithLink(footerText, marginX, footerY, { url: footerUrl });
    } else {
      doc.text(footerText, marginX, footerY);
    }
  };

  const addQuestionBlock = (question: QueuedQuestion, index: number, startY: number) => {
    const qNumber = `Q${index + 1}.`;
    const headerY = startY;
    const metaY = startY + 6;
    const bodyY = startY + 28;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.line(marginX, headerY - 10, pageWidth - marginX, headerY - 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(27, 42, 94);
    doc.text(qNumber, marginX, headerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(45, 55, 72);
    doc.text(`Subtopic: ${question.subtopic}`, marginX + 28, metaY);
    doc.text(`Type: ${question.type}`, marginX + 220, metaY);
    doc.text(`Marks: ${question.marks}`, marginX + 330, metaY);

    doc.setFontSize(10.5);
    doc.setTextColor(17, 24, 39);
    const wrappedText = doc.splitTextToSize(question.questionText, contentWidth - 24);
    const textHeight = wrappedText.length * 14;
    doc.text(wrappedText, marginX + 18, bodyY);

    if (question.sourceLabel) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Source: ${question.sourceLabel}`, marginX + 18, bodyY + textHeight + 12);
    }

    const answerY = bodyY + textHeight + 36;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.line(marginX + 18, answerY, pageWidth - marginX - 18, answerY);

    return answerY + 20;
  };

  drawHeader();
  drawFooter();

  let y = 130;
  questions.forEach((question, index) => {
    if (y > pageHeight - 180) {
      doc.addPage();
      drawHeader();
      drawFooter();
      y = 130;
    }

    y = addQuestionBlock(question, index, y);
  });

  doc.save(`question-paper-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.  QUEUE PANEL  (the main preview + export UI)
// ─────────────────────────────────────────────────────────────────────────────

interface PDFQueuePanelProps {
  /** Override heading. */
  title?: string;
  /** Extra classes on the outermost wrapper. */
  className?: string;
}

export function PDFQueuePanel({
  title = "PDF Export Queue",
  className = "",
}: PDFQueuePanelProps) {
  const { queue, dequeue, clearQueue, updateQuestion } = usePDFQueue();
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const confirmClearRef = useRef<HTMLButtonElement>(null);

  // Focus trap for confirm dialog
  useEffect(() => {
    if (showConfirmClear) confirmClearRef.current?.focus();
  }, [showConfirmClear]);

  const handleExport = async () => {
    if (queue.length === 0) return;
    setIsExporting(true);
    // Allow the loading state to render before the synchronous blob work.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 80));
    try {
      triggerPDFExport(queue);
    } finally {
      setIsExporting(false);
    }
  };

  const atLimit = queue.length >= MAX_QUESTIONS;

  return (
    <section
      aria-label="PDF export question queue"
      className={[
        "flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden",
        className,
      ].join(" ")}
    >
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <FileText className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">
              {queue.length} / {MAX_QUESTIONS} questions
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex-1 max-w-[120px]" aria-hidden>
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                atLimit ? "bg-red-500" : "bg-indigo-500"
              }`}
              style={{ width: `${(queue.length / MAX_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Limit reached banner ── */}
      {atLimit && (
        <div
          role="alert"
          className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
          <p className="text-xs font-medium text-amber-800 leading-snug">
            Question set limit reached. Export the current PDF and delete
            existing questions to start a new 10-question set.
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {queue.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
            <Eye className="h-7 w-7" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-gray-600">No questions yet</p>
          <p className="text-xs text-gray-400 max-w-xs">
            Generate a question and click{" "}
            <span className="font-semibold text-indigo-600">
              Save to PDF Queue
            </span>{" "}
            to begin building your paper. Up to {MAX_QUESTIONS} questions per
            export.
          </p>
        </div>
      )}

      {/* ── Question list ── */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[520px] p-4">
          {queue.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onDelete={() => dequeue(q.id)}
            />
          ))}
        </div>
      )}

      {/* ── Editable preview ── */}
      {queue.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-indigo-600" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Editable PDF preview</h3>
              <p className="text-xs text-gray-500">
                Update the paper content and source before exporting.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {queue.map((q) => (
              <EditableQuestionPreview
                key={q.id}
                question={q}
                onUpdate={(updates) => updateQuestion(q.id, updates)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      {queue.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3">
          {/* Clear all */}
          {showConfirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-red-600">
                Delete all {queue.length} questions?
              </span>
              <button
                ref={confirmClearRef}
                onClick={() => {
                  clearQueue();
                  setShowConfirmClear(false);
                }}
                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Clear all questions from the queue"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear all
            </button>
          )}

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={isExporting || queue.length === 0}
            aria-label={`Export ${queue.length} question${queue.length !== 1 ? "s" : ""} as PDF`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                Export PDF
                <span className="ml-0.5 rounded-md bg-indigo-500 px-1.5 py-0.5 text-xs font-bold">
                  {queue.length}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10.  CONVENIENCE WRAPPER  (standalone, no separate provider needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Self-contained PDF queue panel that includes its own provider.
 * Use this when you do NOT have <PDFQueueProvider> higher up in the tree.
 *
 * If you want the Save button and Panel to share state, wrap both
 * inside a single <PDFQueueProvider> instead.
 */
export function StandalonePDFQueuePanel(props: PDFQueuePanelProps) {
  return (
    <PDFQueueProvider>
      <PDFQueuePanel {...props} />
    </PDFQueueProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11.  DEFAULT EXPORT  (convenience re-export for single-import usage)
// ─────────────────────────────────────────────────────────────────────────────

const QuesPDF = {
  Provider: PDFQueueProvider,
  Panel: PDFQueuePanel,
  SaveButton: SaveToPDFQueueButton,
  useQueue: usePDFQueue,
};

export default QuesPDF;

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION GUIDE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Option A — Shared provider (recommended when Save button + Panel coexist)
 * --------------------------------------------------------------------------
 *   // _app.tsx or layout.tsx
 *   import { PDFQueueProvider } from "@/components/ques-pdf";
 *   <PDFQueueProvider>{children}</PDFQueueProvider>
 *
 *   // QuestionGeneratorOutput.tsx (next to your generated question)
 *   import { SaveToPDFQueueButton } from "@/components/ques-pdf";
 *   <SaveToPDFQueueButton question={currentQuestion} />
 *
 *   // Sidebar.tsx or any panel
 *   import { PDFQueuePanel } from "@/components/ques-pdf";
 *   <PDFQueuePanel />
 *
 *
 * Option B — Standalone panel (self-contained on a single page)
 * --------------------------------------------------------------
 *   import { StandalonePDFQueuePanel } from "@/components/ques-pdf";
 *   <StandalonePDFQueuePanel />
 *   // Note: Save button must also live inside the provider for shared state.
 *
 *
 * Option C — Default import
 * -------------------------
 *   import QuesPDF from "@/components/ques-pdf";
 *   <QuesPDF.Provider>
 *     <QuesPDF.SaveButton question={currentQuestion} />
 *     <QuesPDF.Panel />
 *   </QuesPDF.Provider>
 *
 *
 * GeneratedQuestion shape (map your existing data to this):
 * ----------------------------------------------------------
 *   {
 *     id?: string;            // auto-generated if omitted
 *     questionText: string;
 *     marks: number;
 *     subtopic: string;       // leaf-level topic
 *     topic: string;          // parent chapter / unit
 *     type: string;           // "MCQ" | "Short Answer" | "Long Answer" | …
 *     subject: string;
 *     sourceLabel?: string;   // e.g. "CBSE 2023 Paper 1"
 *   }
 *
 *
 * Persistence:
 *   The queue is stored in localStorage under the key:
 *   "aihub_pdf_question_queue_v1"
 *   Survives page refreshes. Call clearQueue() after export to reset.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */