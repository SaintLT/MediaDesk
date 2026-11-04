import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, FullScreenSpinner } from "@/components/ui";
import type { Role } from "@/types/db";

function AccessScreen({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      <div className="w-full max-w-md rounded-2xl border border-charcoal-700 bg-charcoal-900 p-8">
        <h1 className="text-xl font-semibold text-fog-100">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fog-300">{body}</p>
        <div className="mt-6 flex gap-2">{children}</div>
      </div>
    </main>
  );
}

/** Sends signed-out visitors to /login and stops accounts that are not set up or are deactivated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state, signOut, reload } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case "loading":
      return <FullScreenSpinner label="Loading your account" />;
    case "signed_out":
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    case "blocked":
      return state.reason === "inactive" ? (
        <AccessScreen title="Account deactivated" body="Your MediaDesk account has been deactivated. Contact an administrator if you think this is a mistake.">
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </AccessScreen>
      ) : (
        <AccessScreen title="Account not set up" body="You signed in, but your account has not been added to MediaDesk. Ask an administrator to set it up.">
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </AccessScreen>
      );
    case "error":
      return (
        <AccessScreen title="Could not load your account" body={state.message}>
          <Button onClick={reload}>Try again</Button>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </AccessScreen>
      );
    case "ready":
      return <>{children}</>;
  }
}

/** Convenience only: hides pages a role should not see. The database still enforces real access. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== "ready") return null;
  return roles.includes(state.profile.role) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}
