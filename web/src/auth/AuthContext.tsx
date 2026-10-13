import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { gql, UNAUTHENTICATED_EVENT } from "../lib/graphql";
import { LOGIN, LOGOUT, ME, REGISTER } from "../lib/queries";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Holds the logged-in user for the whole app. The token itself lives in an httpOnly cookie
 * that JavaScript can't read, so we ask the server who we are with the `me` query.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gql<{ me: User | null }>(ME)
      .then(({ me }) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // If any request comes back "not logged in" (e.g. the session expired), drop the user.
    const onUnauthenticated = () => setUser(null);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { login } = await gql<{ login: User }>(LOGIN, { email, password });
    setUser(login);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { register } = await gql<{ register: User }>(REGISTER, { name, email, password });
    setUser(register);
  }, []);

  const logout = useCallback(async () => {
    await gql(LOGOUT).catch(() => undefined);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Wraps pages that need a logged-in user. Real protection is on the server; this is for UX. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
