import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, FullScreenSpinner } from "@/components/ui";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import type { Priority, Status } from "@/types/db";

// Decorative preview of the queue, not real data.
const PREVIEW: { no: string; title: string; priority: Priority; status: Status }[] = [
  { no: "MD-2026-0042", title: "Livestream audio dropping out", priority: "critical", status: "in_progress" },
  { no: "MD-2026-0038", title: "Photo coverage for staff awards", priority: "high", status: "assigned" },
  { no: "MD-2026-0035", title: "Update lobby display slides", priority: "normal", status: "under_review" },
  { no: "MD-2026-0029", title: "Replace spare camera battery", priority: "low", status: "submitted" },
];

export default function Login() {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "loading") return <FullScreenSpinner />;
  if (state.status !== "signed_out") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/dashboard"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const message = await signIn(email, password);
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section aria-hidden className="relative hidden overflow-hidden border-r border-charcoal-700 bg-charcoal-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-electric-500 font-bold text-white shadow-glow">M</span>
          <span className="text-lg font-semibold tracking-tight">MediaDesk</span>
        </div>
        <ul className="space-y-3">
          {PREVIEW.map((t, i) => (
            <li key={t.no} className="flex items-center justify-between gap-4 rounded-xl border border-charcoal-700 bg-charcoal-900/80 px-4 py-3" style={{ marginLeft: `${i * 14}px` }}>
              <div className="min-w-0">
                <p className="text-xs text-fog-500">{t.no}</p>
                <p className="truncate text-sm font-medium">{t.title}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </div>
            </li>
          ))}
        </ul>
        <p className="max-w-sm text-sm text-fog-500">Requests, priorities and progress for the media team, in one queue.</p>
      </section>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-electric-500 font-bold text-white shadow-glow" aria-hidden>M</span>
            <span className="text-lg font-semibold tracking-tight">MediaDesk</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-fog-500">Use the account your administrator created for you.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-fog-300">Email</label>
              <input
                id="email" type="email" autoComplete="username" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 text-sm placeholder:text-fog-700 focus:border-electric-400"
                placeholder="you@organisation.org"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-fog-300">Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 pl-3 pr-11 text-sm focus:border-electric-400"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-fog-500 hover:text-fog-100"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-priority-critical/40 bg-priority-critical/10 px-3 py-2 text-sm text-priority-critical">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} disabled={!email || !password} className="h-11 w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-sm text-fog-500">Forgot your password? Ask an administrator to reset it.</p>
        </div>
      </main>
    </div>
  );
}
