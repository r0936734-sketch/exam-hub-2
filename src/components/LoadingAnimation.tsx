import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface LoadingAnimationProps {
  isVisible: boolean;
  message?: string;
  messages?: string[];
  variant?: "processing" | "success" | "error";
  icon?: string;
  interval?: number;
}

/**
 * Animated loading message component
 * Can display a single message or cycle through multiple messages every 2-3 seconds
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

  const colorClasses = {
    processing: "text-blue-500",
    success: "text-green-500",
    error: "text-red-500",
  };

  const bgClasses = {
    processing: "bg-blue-50 border-blue-200",
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
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
          className={`rounded-lg border p-3 ${bgClasses[variant]}`}
        >
          <div className={`flex items-center gap-3 text-sm ${colorClasses[variant]}`}>
            {icon ? (
              <span className="text-lg">{icon}</span>
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="h-5 w-5 rounded-full border-2 border-current border-t-transparent"
              />
            )}
            <div className="flex-1 min-h-[20px]">
              <motion.span
                key={currentMessageIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="font-medium inline-block"
              >
                {displayMessage}
              </motion.span>
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
