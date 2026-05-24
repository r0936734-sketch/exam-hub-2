import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentSessionServerFn, logoutServerFn } from "@/services/auth.functions";

type Role = "student" | "admin";
type User = { id: string; username: string; name: string };
type AuthState = { user: User | null; role: Role | null; token: string | null };

type Ctx = AuthState & {
  signIn: (user: User, role: Role, token: string) => void;
  signOut: () => void;
  isInitialized?: boolean;
};

const AuthContext = createContext<Ctx | null>(null);
const KEY = "exampro.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, token: null });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        // Try to restore from localStorage first for faster UI loading
        const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setState(parsed);
          } catch (e) {
            // Silently ignore parsing errors
          }
        }
      } catch (e) {
        // Silently ignore errors
      }

      try {
        // Verify and refresh session from server
        const session = await getCurrentSessionServerFn();
        
        if (cancelled) return;

        if (session.user && session.role) {
          const next = { user: session.user, role: session.role, token: "session" };
          setState(next);
          localStorage.setItem(KEY, JSON.stringify(next));
        } else {
          setState({ user: null, role: null, token: null });
          localStorage.removeItem(KEY);
        }
      } catch (error) {
        if (cancelled) return;
        // Log error for debugging but don't crash
        console.error("Session initialization error:", error);
        setState({ user: null, role: null, token: null });
        localStorage.removeItem(KEY);
      } finally {
        if (!cancelled) {
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = (user: User, role: Role, token: string) => {
    const next = { user, role, token };
    setState(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const signOut = () => {
    setState({ user: null, role: null, token: null });
    localStorage.removeItem(KEY);
    setIsInitialized(true);
    logoutServerFn().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, isInitialized }}>
      {isInitialized ? children : <InitializingAuth />}
    </AuthContext.Provider>
  );
}

// Minimal loading indicator while auth is being initialized
function InitializingAuth() {
  return null; // Silent loading, or you can add a spinner here
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
