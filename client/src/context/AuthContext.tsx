import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

interface AuthState {
  /** null for anonymous guests */
  user: PublicUser | null;
  /** Guests only: free AI questions left (null when signed in or unknown) */
  freeQuestionsLeft: number | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [freeQuestionsLeft, setFreeQuestionsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Sessions live in httpOnly cookies ("token" for users, "a" for guests), so ask the server who we are.
  // The first call also gives a new visitor their anonymous session.
  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me.user);
      setFreeQuestionsLeft(me.freeQuestionsLeft);
    } catch {
      setUser(null);
      setFreeQuestionsLeft(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setUser(user);
    setFreeQuestionsLeft(null);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, freeQuestionsLeft, loading, login, logout, refresh }),
    [user, freeQuestionsLeft, loading, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
