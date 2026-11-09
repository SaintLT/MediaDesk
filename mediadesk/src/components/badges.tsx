import { ArrowDown, ArrowUp, Flame, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "@/types/db";

// Priority is shown with colour + icon + text, so it never relies on colour alone.
const PRIORITY_STYLE: Record<Priority, { icon: LucideIcon; cls: string }> = {
  critical: { icon: Flame,     cls: "bg-priority-critical/15 text-priority-critical ring-priority-critical/40" },
  high:     { icon: ArrowUp,   cls: "bg-priority-high/15 text-priority-high ring-priority-high/40" },
  medium:   { icon: Minus,     cls: "bg-priority-medium/15 text-priority-medium ring-priority-medium/40" },
  low:      { icon: ArrowDown, cls: "bg-priority-low/15 text-priority-low ring-priority-low/40" },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const { icon: Icon, cls } = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", cls, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const STATUS_STYLE: Record<Status, { dot: string; text: string }> = {
  submitted:    { dot: "bg-fog-500",           text: "text-fog-300" },
  under_review: { dot: "bg-electric-300",      text: "text-electric-300" },
  assigned:     { dot: "bg-electric-400",      text: "text-electric-300" },
  in_progress:  { dot: "bg-electric-500",      text: "text-fog-100" },
  on_hold:      { dot: "bg-status-hold",       text: "text-status-hold" },
  completed:    { dot: "bg-status-done",       text: "text-status-done" },
  cancelled:    { dot: "bg-status-cancelled",  text: "text-fog-500" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.text, className)}>
      <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
