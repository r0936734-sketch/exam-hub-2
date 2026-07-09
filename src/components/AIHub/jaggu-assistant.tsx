import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  ImagePlus,
  Loader2,
  Paperclip,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FormattedAIText } from "@/components/AIHub/formatted-ai-text";
import { askJagguFn } from "@/services/aihub.server";
import aiGif from "../../../ai.gif";
import aiThinkingGif from "../../../ai2.gif";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  imagePreview?: string;
}

interface JagguAssistantProps {
  subject: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  embedInMain?: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export function JagguAssistant({ subject, isOpen: controlledOpen, onOpenChange, embedInMain }: JagguAssistantProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = embedInMain ? true : isControlled ? controlledOpen! : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (embedInMain) return;
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I’m Jaggu, your AI study companion. Ask me anything about your topic, request explanations, or upload an image and I’ll help you study it step by step.",
    },
  ]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      event.target.value = "";
      return;
    }

    try {
      const preview = await readFileAsDataUrl(file);
      setImagePreview(preview);
      setImageName(file.name);
      setError("");
    } catch {
      setError("Failed to process the selected image");
    } finally {
      event.target.value = "";
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageName("");
    setError("");
  };

  const handleSend = async () => {
    const prompt = draft.trim();
    if (!prompt && !imagePreview) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: prompt || "Please help me with this image.",
      imagePreview: imagePreview ?? undefined,
    };

    // determine previous user message BEFORE appending the new one
    const prev = ((): ChatMessage | null => {
      const current = messages;
      if (!current || current.length === 0) return null;
      const lastUser = [...current].reverse().find((m) => m.role === "user");
      if (!lastUser) return null;
      if (lastUser.id === "welcome") return null;
      return lastUser;
    })();

    // append the user message immediately for optimistic UI
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);
    setError("");

    try {
      const response = await askJagguFn({
        data: {
          prompt,
          subject,
          imageDataUrls: imagePreview ? [imagePreview] : [],
          previousMessage: prev?.content,
        },
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: response.reply || "I’m ready to help with that.",
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: `Sorry, I hit a snag. ${err instanceof Error ? err.message : "Please try again."}`,
        },
      ]);
    } finally {
      setImagePreview(null);
      setImageName("");
      setIsSending(false);
    }
  };

  const chatPanel = (
    <motion.div
      initial={{ y: 24, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 24, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="flex max-h-[92dvh] w-full flex-col rounded-2xl border border-border/70 bg-background/95 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <img
            src={isSending ? aiThinkingGif : aiGif}
            alt="Jaggu"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold">Jaggu</p>
            <p className="text-xs text-muted-foreground">
              {isSending ? "Thinking…" : "Study help • questions • images"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm shadow-sm sm:max-w-[85%] ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/70 bg-card/80 text-foreground"
              }`}
            >
              {message.imagePreview ? (
                <img src={message.imagePreview} alt="Uploaded preview" className="mb-2 max-h-44 rounded-lg object-cover" />
              ) : null}
              <FormattedAIText className="prose prose-sm max-w-none break-words dark:prose-invert">
                {message.content}
              </FormattedAIText>
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Jaggu is preparing your answer…
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 bg-background/80 px-3 py-3 sm:px-4">
        {imagePreview ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-primary" />
              <span className="truncate">{imageName || "Attached image"}</span>
            </div>
            <button type="button" onClick={removeImage} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background px-2 py-2 shadow-inner">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask Jaggu anything…"
            className="min-h-[78px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            disabled={isSending}
          />
          <div className="flex flex-col gap-2">
            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20">
              <Paperclip className="h-4 w-4" />
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
            </label>
            <Button size="icon" onClick={() => void handleSend()} disabled={isSending || (!draft.trim() && !imagePreview)}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Can make mistakes
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      {!embedInMain && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`${embedInMain ? "absolute" : "fixed"} bottom-4 right-4 z-[55] flex items-center gap-2 rounded-full border border-primary/25 bg-background/90 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur sm:bottom-6 sm:right-6`}
          aria-label="Open Jaggu assistant"
        >
          <img src={aiGif} alt="Jaggu" className="h-10 w-10 rounded-full object-cover" />
          <span className="text-sm font-semibold text-foreground">Jaggu</span>
        </button>
      )}

      <AnimatePresence>
        {isOpen ? (
          embedInMain ? (
            <motion.div className="relative w-full">
              {chatPanel}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-sm sm:bg-transparent"
            >
              <motion.div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-h-[92dvh] flex-col sm:bottom-6 sm:right-6 sm:left-auto sm:w-[45vw]">
                {chatPanel}
              </motion.div>
            </motion.div>
          )
        ) : null}
      </AnimatePresence>
    </>
  );
}
