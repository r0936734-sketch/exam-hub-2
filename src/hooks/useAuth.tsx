import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Role = "student" | "admin";
type User = { id: string; username: string; name: string };
type AuthState = { user: User | null; role: Role | null; token: string | null };

type Ctx = AuthState & {
  signIn: (user: User, role: Role, token: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<Ctx | null>(null);
const KEY = "exampro.auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, token: null });

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setState(parsed);
      }
    } catch (e) {
      // Silently ignore parsing errors
    }
  }, []);

  const signIn = (user: User, role: Role, token: string) => {
    const next = { user, role, token };
    setState(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const signOut = () => {
    setState({ user: null, role: null, token: null });
    localStorage.removeItem(KEY);
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
