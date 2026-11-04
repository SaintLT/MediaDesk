import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-electric-500 text-white hover:bg-electric-600 active:bg-electric-700",
  secondary: "bg-charcoal-700 text-fog-100 ring-1 ring-inset ring-charcoal-500 hover:bg-charcoal-600",
  ghost: "text-fog-300 hover:bg-charcoal-800 hover:text-fog-100",
  danger: "bg-priority-critical/15 text-priority-critical ring-1 ring-inset ring-priority-critical/40 hover:bg-priority-critical/25",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({ variant = "primary", loading = false, type = "button", className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function FullScreenSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-ink text-fog-500">
      <Loader2 className="h-6 w-6 animate-spin text-electric-400" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-fog-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
