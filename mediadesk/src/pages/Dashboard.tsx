import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/AuthContext";
import { ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, Clock3, Plus, Ticket as TicketIcon, TrendingUp } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/tickets/Badges";

type Ticket = {
  id: string; ticket_number: string | null; title: string; status: string; priority: string;
  due_date: string | null; submitted_at: string | null; requester_id: string | null; assigned_to: string | null;
};
const CLOSED = ["completed", "cancelled"];
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const pretty = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
function queueSort(a: Ticket, b: Ticket) {
  const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (p) return p;
  const ad = a.due_date ?? "9999-12-31", bd = b.due_date ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
}
function StatCard({ label, value, icon: Icon, tone = "blue", hint }: {
  label: string; value: number; icon: typeof TicketIcon; tone?: "blue" | "amber" | "red" | "green"; hint: string;
}) {
  const tones = {
    blue: "bg-electric-500/10 text-electric-300 ring-electric-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    red: "bg-red-500/10 text-red-400 ring-red-500/20",
    green: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  };
  return <article className="group rounded-2xl border border-charcoal-700 bg-charcoal-950 p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-electric-500/40">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-fog-500">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-fog-100">{value}</p></div>
      <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
    </div>
    <p className="mt-4 text-xs text-fog-500">{hint}</p>
  </article>;
}
function TicketRow({ ticket }: { ticket: Ticket }) {
  return <Link to={`/tickets/${ticket.id}`} className="group flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition duration-200 hover:border-charcoal-600 hover:bg-charcoal-800/60">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-electric-500/10 text-electric-300"><TicketIcon className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fog-100 group-hover:text-electric-300">{ticket.title}</span><span className="mt-1 block text-xs text-fog-500">{ticket.ticket_number ?? "Ticket"} · {pretty(ticket.status)}{ticket.due_date ? ` · Due ${ticket.due_date}` : ""}</span></span>
    <span className="flex items-center gap-2"><PriorityBadge priority={ticket.priority as any} /><ArrowUpRight className="h-4 w-4 text-fog-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-electric-300" /></span>
  </Link>;
}
function Panel({ title, subtitle, items, empty, action }: { title: string; subtitle: string; items: Ticket[]; empty: string; action?: React.ReactNode }) {
  return <section className="rounded-2xl border border-charcoal-700 bg-charcoal-950 p-5 shadow-card">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-fog-100">{title}</h2><p className="mt-1 text-xs text-fog-500">{subtitle}</p></div>{action}</div>
    {items.length ? <div className="space-y-1">{items.map((t) => <TicketRow key={t.id} ticket={t} />)}</div> : <div className="rounded-xl border border-dashed border-charcoal-600 px-4 py-9 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" /><p className="mt-3 text-sm font-medium text-fog-200">{empty}</p></div>}
  </section>;
}
export default function Dashboard() {
  const profile = useProfile();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("tickets").select("*").order("submitted_at", { ascending: false }).limit(500);
      if (!active) return;
      if (error) setError(error.message); else setTickets((data ?? []) as Ticket[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);
  const isAdmin = profile.role === "administrator";
  const view = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    const open = tickets.filter((t) => !CLOSED.includes(t.status));
    const count = (list: Ticket[], status: string) => list.filter((t) => t.status === status).length;
    const recent = tickets.slice(0, 6);
    if (isAdmin) {
      const unassigned = open.filter((t) => !t.assigned_to && ["submitted", "under_review"].includes(t.status));
      const overdue = open.filter((t) => t.due_date && t.due_date < today);
      return {
        stats: [
          { label: "Open tickets", value: open.length, icon: TicketIcon, tone: "blue" as const, hint: "Requests still in the queue" },
          { label: "Awaiting assignment", value: unassigned.length, icon: Clock3, tone: "amber" as const, hint: "Needs an administrator" },
          { label: "Overdue", value: overdue.length, icon: CircleAlert, tone: "red" as const, hint: "Past their required date" },
          { label: "On hold", value: count(open, "on_hold"), icon: CalendarClock, tone: "green" as const, hint: "Temporarily paused" },
        ],
        primaryTitle: "Needs attention", primarySubtitle: "Prioritised requests that may need action",
        primary: [...unassigned, ...overdue.filter((t) => !unassigned.includes(t))].sort(queueSort).slice(0, 8),
        primaryEmpty: "You're all caught up. Nothing needs attention right now.",
      };
    }
    return {
      stats: [
        { label: "My open tickets", value: open.length, icon: TicketIcon, tone: "blue" as const, hint: "Requests currently in progress" },
        { label: "On hold", value: count(open, "on_hold"), icon: CalendarClock, tone: "amber" as const, hint: "Waiting to resume" },
        { label: "Completed", value: count(tickets, "completed"), icon: CheckCircle2, tone: "green" as const, hint: "Requests successfully resolved" },
        { label: "Cancelled", value: count(tickets, "cancelled"), icon: CircleAlert, tone: "red" as const, hint: "Requests you cancelled" },
      ],
      primaryTitle: "My open tickets", primarySubtitle: "A quick view of your active requests",
      primary: [...open].sort(queueSort).slice(0, 8),
      primaryEmpty: "You have no open tickets. Submit a request whenever you need help.",
    };
  }, [tickets, isAdmin]);
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "there";
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((n) => <div key={n} className="h-36 animate-pulse rounded-2xl bg-charcoal-800" />)}</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">Could not load dashboard: {error}</div>;
  return <div className="space-y-7 animate-rise">
    <section className="relative overflow-hidden rounded-3xl border border-electric-500/20 bg-gradient-to-br from-electric-500/15 via-charcoal-950 to-charcoal-950 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-electric-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-electric-400/20 bg-electric-500/10 px-3 py-1 text-xs font-semibold text-electric-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Workspace overview</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">Good day, {firstName}<span className="text-electric-400">.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-fog-500">Here's the latest on your support workspace. Stay on top of requests and keep work moving.</p>
        </div>
        <Link to="/submit" className="inline-flex h-11 items-center gap-2 rounded-xl bg-electric-500 px-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-electric-400"><Plus className="h-4 w-4" /> New ticket</Link>
      </div>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{view.stats.map((s) => <StatCard key={s.label} {...s} />)}</section>
    <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <Panel title={view.primaryTitle} subtitle={view.primarySubtitle} items={view.primary} empty={view.primaryEmpty} action={<Link to={isAdmin ? "/tickets" : "/my-tickets"} className="text-xs font-semibold text-electric-300 hover:text-electric-200">View all <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></Link>} />
      <Panel title="Recently submitted" subtitle="The latest activity in your workspace" items={tickets.slice(0, 6)} empty="No tickets have been submitted yet." action={<TrendingUp className="h-4 w-4 text-fog-500" />} />
    </section>
    <p className="text-center text-xs text-fog-700">MediaDesk · Support that keeps things moving.</p>
  </div>;
}