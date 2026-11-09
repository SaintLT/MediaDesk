import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenSpinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type Department = { id: string; name: string };

const EMAIL_DOMAIN = "@allsaintsnairobi.org";

export default function Signup() {
  const { state } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke("public-signup", {
      body: { action: "list_departments" },
    }).then(({ data, error: invokeError }) => {
      if (cancelled) return;
      if (invokeError) {
        setDepartmentError("Departments could not be loaded. Please refresh and try again.");
      } else {
        const rows = (data?.departments ?? []) as Department[];
        setDepartments(rows);
        if (rows.length) setDepartmentId(rows[0].id);
        else setDepartmentError("No active departments are currently available.");
      }
      setDepartmentsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") return <FullScreenSpinner />;
  if (state.status !== "signed_out") return <Navigate to="/dashboard" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(EMAIL_DOMAIN)) {
      setError(`Registration is limited to email addresses ending in ${EMAIL_DOMAIN}.`);
      return;
    }
    if (password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!departmentId) {
      setError("Please choose your department.");
      return;
    }

    setSubmitting(true);
    const { error: invokeError } = await supabase.functions.invoke("public-signup", {
      body: {
        full_name: fullName.trim(),
        email: normalizedEmail,
        department_id: departmentId,
        password,
      },
    });
    setSubmitting(false);

    if (invokeError) {
      const response = (invokeError as { context?: Response }).context;
      if (response) {
        try {
          const payload = await response.clone().json() as { error?: string };
          setError(payload.error || invokeError.message);
          return;
        } catch {
          // Fall through to the function client's message.
        }
      }
      setError(invokeError.message || "Could not create your account. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-electric-500 font-bold text-white shadow-glow" aria-hidden>M</span>
          <span className="text-lg font-semibold tracking-tight">MediaDesk</span>
        </div>

        {submitted ? (
          <section className="rounded-2xl border border-charcoal-700 bg-charcoal-900/70 p-6">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-electric-500/15 text-electric-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-2 text-sm leading-6 text-fog-400">
              We have sent a verification link to <strong className="text-fog-100">{email.trim().toLowerCase()}</strong>.
              Open that message and verify your email address before signing in.
            </p>
            <Link to="/login" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-electric-500 px-4 text-sm font-semibold text-white transition hover:bg-electric-400">
              Back to sign in
            </Link>
          </section>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="mt-1 text-sm text-fog-500">
              Register with your All Saints Nairobi email address. New accounts are created as Normal Users.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
              <div>
                <label htmlFor="full-name" className="mb-1.5 block text-sm font-medium text-fog-300">Full name</label>
                <input id="full-name" type="text" autoComplete="name" required maxLength={120}
                  value={fullName} onChange={(event) => setFullName(event.target.value)}
                  className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 text-sm focus:border-electric-400"
                  placeholder="Your full name" />
              </div>

              <div>
                <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-fog-300">Organisation email</label>
                <input id="signup-email" type="email" autoComplete="email" required
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 text-sm focus:border-electric-400"
                  placeholder={`you${EMAIL_DOMAIN}`} />
                <p className="mt-1.5 text-xs text-fog-500">Only {EMAIL_DOMAIN} addresses can register.</p>
              </div>

              <div>
                <label htmlFor="department" className="mb-1.5 block text-sm font-medium text-fog-300">Department</label>
                <select id="department" required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}
                  disabled={departmentsLoading || departments.length === 0}
                  className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 text-sm focus:border-electric-400 disabled:opacity-60">
                  <option value="">Choose your department</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                {departmentError && <p role="alert" className="mt-1 text-xs text-priority-critical">{departmentError}</p>}
                {!departmentsLoading && !departmentError && departments.length === 0 && (
                  <p className="mt-1 text-xs text-fog-500">No active departments are currently available. Contact an administrator.</p>
                )}
              </div>

              <div>
                <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-fog-300">Password</label>
                <div className="relative">
                  <input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={10}
                    value={password} onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 pl-3 pr-11 text-sm focus:border-electric-400"
                    placeholder="At least 10 characters" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-fog-500 hover:text-fog-100">
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-fog-300">Confirm password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" required
                  value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 text-sm focus:border-electric-400" />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-priority-critical/40 bg-priority-critical/10 px-3 py-2 text-sm text-priority-critical">
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting || departmentsLoading || !!departmentError || departments.length === 0 || !fullName.trim() || !email.trim() || !password || !confirmPassword}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-electric-500 px-4 text-sm font-semibold text-white transition hover:bg-electric-400 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-fog-500">
              Already have an account? <Link to="/login" className="font-medium text-electric-300 hover:text-electric-200">Sign in</Link>
            </p>
            <p className="mt-4 text-center text-xs leading-5 text-fog-600">
              By registering, you will receive Normal User access. Administrator access can only be assigned by an existing administrator.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
