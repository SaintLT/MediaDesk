import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/db";

export type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "blocked"; reason: "no_profile" | "inactive" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reload: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!userId) {
      setState({ status: "signed_out" });
      return;
    }
    let cancelled = false;
    setState((prev) => (prev.status === "ready" && prev.profile.id === userId ? prev : { status: "loading" }));

    supabase
      .from("profiles")
      .select("id, full_name, email, department_id, role, is_active, department:departments(name)")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ status: "error", message: error.message });
        } else if (!data) {
          setState({ status: "blocked", reason: "no_profile" });
        } else if (!data.is_active) {
          setState({ status: "blocked", reason: "inactive" });
        } else {
          setState({ status: "ready", profile: data as unknown as Profile });
        }
      });
    return () => { cancelled = true; };
  }, [userId, sessionLoaded, reloadKey]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error) return null;

    const code = (error as { code?: string }).code ?? "";
    const msg = error.message ?? "";
    if (import.meta.env.DEV) console.warn("[auth] sign-in failed", { status: error.status, code, message: msg });

    if (code === "email_not_confirmed" || /email not confirmed/i.test(msg))
      return "This account's email address has not been confirmed. Ask an administrator to confirm it.";
    if (code === "user_banned" || /banned/i.test(msg))
      return "This account has been deactivated. Contact an administrator.";
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
      return "Incorrect email or password.";
    if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
    if (!error.status) return "Could not reach the server. Check your connection and try again.";
    return `Could not sign in (${code || error.status}): ${msg}`;
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const value = useMemo(() => ({ state, signIn, signOut, reload }), [state, signIn, signOut, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in, active user's profile. Only call inside routes wrapped by <RequireAuth>. */
export function useProfile(): Profile {
  const { state } = useAuth();
  if (state.status !== "ready") throw new Error("useProfile called without a signed-in user");
  return state.profile;
}