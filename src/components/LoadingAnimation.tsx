import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import aiBotGif from "../../ai.gif";

interface LoadingAnimationProps {
  isVisible: boolean;
  message?: string;
  messages?: string[];
  variant?: "processing" | "success" | "error";
  icon?: string;
  interval?: number;
}

/**
 * Animated loading message component.
 * Shows progress as a compact AI assistant status bubble.
 */
export function LoadingAnimation({
  isVisible,
  message,
  messages,
  variant = "processing",
  icon,
  interval = 2500,
}: LoadingAnimationProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Handle cycling through messages
  useEffect(() => {
    if (!isVisible || !messages || messages.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [isVisible, messages, interval]);

  // Reset to first message when messages change
  useEffect(() => {
    if (isVisible && messages) {
      setCurrentMessageIndex(0);
    }
  }, [isVisible, messages]);

  const statusLabels = {
    processing: "Working on your request",
    success: "Completed",
    error: "Needs attention",
  };

  const frameClasses = {
    processing:
      "border-blue-200 bg-blue-50/90 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-50",
    success:
      "border-green-200 bg-green-50/90 text-green-950 dark:border-green-900/70 dark:bg-green-950/35 dark:text-green-50",
    error:
      "border-red-200 bg-red-50/90 text-red-950 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-50",
  };

  const accentClasses = {
    processing: "bg-blue-500 shadow-blue-500/30",
    success: "bg-green-500 shadow-green-500/30",
    error: "bg-red-500 shadow-red-500/30",
  };

  // Determine which message to display
  const displayMessage = messages ? messages[currentMessageIndex] : message;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={`overflow-hidden rounded-xl border p-3 shadow-sm sm:p-4 ${frameClasses[variant]}`}
        >
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="relative h-14 w-14 shrink-0 rounded-xl border border-current/10 bg-white/70 p-1.5 shadow-sm dark:bg-slate-950/30 sm:h-16 sm:w-16">
              <img
                src={aiBotGif}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain"
              />
              <span
                className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full shadow-lg ${accentClasses[variant]}`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  {statusLabels[variant]}
                </span>
                {icon && <span className="text-sm leading-none">{icon}</span>}
              </div>
              <motion.span
                key={currentMessageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="block break-words text-sm font-medium leading-6 sm:text-base"
              >
                {displayMessage}
              </motion.span>

              {variant === "processing" && (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-current/10">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-current/55"
                    animate={{ x: ["-120%", "320%"] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Progress indicator with multiple steps
 */
export function LoadingProgress({
  steps: stepList,
  currentStep,
  isVisible,
}: {
  steps: string[];
  currentStep: number;
  isVisible: boolean;
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-2"
        >
          {stepList.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  index < currentStep
                    ? "bg-green-500 text-white"
                    : index === currentStep
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {index < currentStep ? "✓" : index + 1}
              </div>
              <span
                className={
                  index <= currentStep ? "font-medium text-gray-900" : "text-gray-500"
                }
              >
                {step}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Scrolling text animation for status updates
 */
export function ScrollingStatusText({
  messages,
  isVisible,
}: {
  messages: string[];
  isVisible: boolean;
}) {
  return (
    <AnimatePresence>
      {isVisible && messages.length > 0 && (
        <motion.div className="overflow-hidden rounded-lg bg-gray-50 p-3">
          <motion.div
            key={messages[messages.length - 1]}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs font-mono text-gray-600"
          >
            {messages[messages.length - 1]}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
