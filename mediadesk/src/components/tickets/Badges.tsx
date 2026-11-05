import type { Priority, Status } from '../../types/ticket';

const PRIORITY_STYLES: Record<Priority, string> = {
  Critical: 'bg-red-500/15 text-red-300 ring-red-500/30',
  High: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  Normal: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  Low: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
};

const STATUS_STYLES: Record<Status, string> = {
  Submitted: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  'Under Review': 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  Assigned: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
  'In Progress': 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  'On Hold': 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  Completed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  Cancelled: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
};

const base =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{priority}</span>;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{status}</span>;
}
