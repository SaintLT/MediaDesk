import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/AuthContext";

type Ticket = {
  id: string;
  ticket_number: string | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  submitted_at: string | null;
  requester_id: string | null;
  assigned_to: string | null;
};

const CLOSED = ["completed", "cancelled"];
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const priorityStyle: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/15 text-red-300",
  high: "border-orange-500/30 bg-orange-500/15 text-orange-300",
  medium: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  low: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
};

const pretty = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Queue rule: priority, then earliest required date, then oldest submission
function queueSort(a: Ticket, b: Ticket) {
  const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (p) return p;
  const ad = a.due_date ?? "9999-12-31";
  const bd = b.due_date ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (a.submitted_at ?? "") < (b.submitted_at ?? "") ? -1 : 1;
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone || "text-white"}`}>{value}</p>
    </div>
  );
}

function TicketLine({ t }: { t: Ticket }) {
  return (
    <Link
      to={`/tickets/${t.id}`}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition hover:bg-zinc-800/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100">{t.title}</p>
        <p className="text-xs text-zinc-500">
          {t.ticket_number ?? "—"} · {pretty(t.status)}
          {t.due_date ? ` · due ${t.due_date}` : ""}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
          priorityStyle[t.priority] ?? priorityStyle.medium
        }`}
      >
        {pretty(t.priority)}
      </span>
    </Link>
  );
}

function Panel({ title, items, empty }: { title: string; items: Ticket[]; empty: string }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="mb-2 text-sm font-semibold text-zinc-200">{title}</h2>
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((t) => (
            <TicketLine key={t.id} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const profile = useProfile();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // RLS already limits what each role can see
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (!active) return;
      if (error) setError(error.message);
      else setTickets((data ?? []) as Ticket[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const role = profile.role;
  const isManager = role === "administrator" || role === "media_manager";
  const isMember = role === "media_member";

  const view = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
    const weekAhead = new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA");
    const open = tickets.filter((t) => !CLOSED.includes(t.status));
    const mine = tickets.filter((t) => t.assigned_to === profile.id);
    const myOpen = mine.filter((t) => !CLOSED.includes(t.status));
    const count = (list: Ticket[], status: string) => list.filter((t) => t.status === status).length;
    const recent = tickets.slice(0, 6);

    if (isManager) {
      const unassigned = open.filter((t) => !t.assigned_to && ["submitted", "under_review"].includes(t.status));
      const overdue = open.filter((t) => t.due_date && t.due_date < today);
      return {
        stats: [
          { label: "Open tickets", value: open.length },
          { label: "Awaiting assignment", value: unassigned.length, tone: "text-blue-400" },
          { label: "Overdue", value: overdue.length, tone: overdue.length ? "text-red-400" : "" },
          { label: "On hold", value: count(open, "on_hold") },
        ],
        primaryTitle: "Needs attention",
        primary: [...unassigned, ...overdue.filter((t) => !unassigned.includes(t))].sort(queueSort).slice(0, 8),
        primaryEmpty: "Nothing waiting. The queue is under control.",
        recent,
      };
    }

    if (isMember) {
      return {
        stats: [
          { label: "My active tickets", value: myOpen.length },
          {
            label: "Due within 7 days",
            value: myOpen.filter((t) => t.due_date && t.due_date <= weekAhead).length,
            tone: "text-blue-400",
          },
          { label: "On hold", value: count(myOpen, "on_hold") },
          { label: "Completed by me", value: count(mine, "completed") },
        ],
        primaryTitle: "My queue",
        primary: [...myOpen].sort(queueSort).slice(0, 8),
        primaryEmpty: "No tickets assigned to you right now.",
        recent,
      };
    }

    return {
      stats: [
        { label: "My open tickets", value: open.length },
        { label: "On hold", value: count(open, "on_hold") },
        { label: "Completed", value: count(tickets, "completed") },
        { label: "Cancelled", value: count(tickets, "cancelled") },
      ],
      primaryTitle: "My open tickets",
      primary: [...open].sort(queueSort).slice(0, 8),
      primaryEmpty: "You have no open tickets. Use Submit Ticket to request help.",
      recent,
    };
  }, [tickets, profile.id, isManager, isMember]);

  if (loading) return <p className="p-6 text-sm text-zinc-400">Loading dashboard…</p>;
  if (error) return <p className="p-6 text-sm text-red-400">Could not load dashboard: {error}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">
          Welcome{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-zinc-400">Here is where things stand today.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {view.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={view.primaryTitle} items={view.primary} empty={view.primaryEmpty} />
        <Panel title="Recent tickets" items={view.recent} empty="No tickets yet." />
      </div>
    </div>
  );
}