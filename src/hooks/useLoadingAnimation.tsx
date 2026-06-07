import { useState, useCallback } from "react";
import { formatLoadingMessage } from "@/lib/loading-messages";

/**
 * Hook for managing loading state with animated messages
 */
export function useLoadingAnimation() {
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [frameIndex, setFrameIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Handle progress updates from server functions
  const onProgress = useCallback((message: string) => {
    setLoadingMessage(message);
    setFrameIndex((prev) => prev + 1);
  }, []);

  // Start loading animation
  const startLoading = useCallback(() => {
    setIsLoading(true);
    setFrameIndex(0);
  }, []);

  // Stop loading animation
  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage("");
    setFrameIndex(0);
  }, []);

  // Get formatted message with animation
  const formattedMessage = formatLoadingMessage(loadingMessage, frameIndex);

  return {
    loadingMessage: formattedMessage,
    isLoading,
    startLoading,
    stopLoading,
    onProgress,
    rawMessage: loadingMessage,
  };
}

/**
 * Hook for managing multiple concurrent loading states
 */
export function useMultipleLoadingStates(keys: string[]) {
  const [states, setStates] = useState<Record<string, string>>(() =>
    keys.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
  );

  const setLoadingMessage = useCallback((key: string, message: string) => {
    setStates((prev) => ({ ...prev, [key]: message }));
  }, []);

  return {
    states,
    setLoadingMessage,
  };
}
