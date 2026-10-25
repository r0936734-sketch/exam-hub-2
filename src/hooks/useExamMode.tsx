import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EXAM_MODES, getExamMode, type ExamMode, type ExamModeId } from "@/lib/exam-modes";
import { useAuth } from "@/hooks/useAuth";

type ExamModeContextValue = {
  mode: ExamMode;
  chooseMode: (id: ExamModeId) => void;
  chooserOpen: boolean;
  setChooserOpen: (open: boolean) => void;
};

const ExamModeContext = createContext<ExamModeContextValue | null>(null);

export function ExamModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = `exampro.exam-mode.${user?.id || "visitor"}`;
  const [modeId, setModeId] = useState<ExamModeId>("lt-grade");
  const [chooserOpen, setChooserOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as ExamModeId | null;
    if (stored && EXAM_MODES[stored]) setModeId(stored);
    setChooserOpen(true);
  }, [storageKey]);

  const value = useMemo<ExamModeContextValue>(() => ({
    mode: getExamMode(modeId),
    chooseMode: (id) => {
      setModeId(id);
      window.localStorage.setItem(storageKey, id);
      setChooserOpen(false);
    },
    chooserOpen,
    setChooserOpen,
  }), [chooserOpen, modeId, storageKey]);

  return <ExamModeContext.Provider value={value}>{children}</ExamModeContext.Provider>;
}

export function useExamMode() {
  const context = useContext(ExamModeContext);
  if (!context) throw new Error("useExamMode must be used within ExamModeProvider");
  return context;
}
