import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowUpRight, Ticket as TicketIcon, CalendarDays, Users } from "lucide-react";
import { fetchTickets } from "@/lib/tickets";
import { PriorityBadge, StatusBadge } from "@/components/tickets/Badges";
import { STATUSES, STATUS_LABELS } from "@/types/db";
import type { Ticket, TicketScope } from "@/types/ticket";
import { PageHeader } from "@/components/ui";

interface Props { scope: TicketScope; title: string; subtitle?: string; }
export default function TicketList({ scope, title, subtitle }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(null);
    fetchTickets(scope).then((rows) => { if (!cancelled) setTickets(rows); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? "Could not load tickets."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.ticket_number.toLowerCase().includes(q) || (t.requester_name ?? "").toLowerCase().includes(q);
    });
  }, [tickets, search, statusFilter]);
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "—";
  const openCount = tickets.filter((t) => !["completed", "cancelled"].includes(t.status)).length;
  return <div className="space-y-6 animate-rise">
    <PageHeader title={title} description={subtitle} actions={<span className="rounded-full border border-charcoal-600 bg-charcoal-900 px-3 py-1.5 text-xs font-medium text-fog-300">{tickets.length} total · {openCount} open</span>} />
    <section className="rounded-2xl border border-charcoal-700 bg-charcoal-950 p-4 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" /><input aria-label="Search tickets" className="h-11 w-full rounded-xl border border-charcoal-600 bg-charcoal-900 pl-10 pr-3 text-sm text-fog-100 outline-none transition placeholder:text-fog-700 focus:border-electric-400 focus:ring-2 focus:ring-electric-500/15" placeholder="Search by title, ticket number or requester…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="relative md:w-56"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog-500" /><select aria-label="Filter by status" className="h-11 w-full appearance-none rounded-xl border border-charcoal-600 bg-charcoal-900 pl-10 pr-3 text-sm text-fog-100 outline-none focus:border-electric-400" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-fog-500"><span>{visible.length} result{visible.length === 1 ? "" : "s"}</span><button type="button" onClick={() => { setSearch(""); setStatusFilter(""); }} className="font-medium text-electric-300 hover:text-electric-200">Clear filters</button></div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-charcoal-700 bg-charcoal-950 shadow-card">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(110px,.7fr)_minmax(120px,.8fr)_minmax(140px,1fr)_minmax(110px,.7fr)] gap-4 border-b border-charcoal-700 bg-charcoal-900/70 px-5 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-fog-500 lg:grid">
        <span>Ticket</span><span>Priority</span><span>Status</span>{scope !== "mine" && <span>Requester</span>}{scope === "mine" && <span>Category</span>}<span>Needed by</span>
      </div>
      {loading ? <div className="space-y-3 p-5">{[1,2,3,4].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-charcoal-800" />)}</div> :
        visible.length === 0 ? <div className="px-5 py-16 text-center"><TicketIcon className="mx-auto h-8 w-8 text-fog-700" /><h3 className="mt-3 text-sm font-semibold text-fog-200">{tickets.length ? "No matching tickets" : "No tickets yet"}</h3><p className="mt-1 text-sm text-fog-500">{tickets.length ? "Try adjusting your search or filters." : "When a request is submitted, it will appear here."}</p></div> :
        <div className="divide-y divide-charcoal-700">{visible.map((t) => <Link key={t.id} to={`/tickets/${t.id}`} className="group grid gap-3 px-4 py-4 transition duration-200 hover:bg-charcoal-900/70 sm:px-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(110px,.7fr)_minmax(120px,.8fr)_minmax(140px,1fr)_minmax(110px,.7fr)] lg:items-center lg:gap-4">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-electric-500/10 text-electric-300"><TicketIcon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-fog-100 group-hover:text-electric-300">{t.title}</span><span className="mt-1 block truncate font-mono text-[11px] text-fog-500">{t.ticket_number}</span></span><ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-fog-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-electric-300 lg:hidden" /></div>
          <div className="flex items-center justify-between gap-2 lg:block"><span className="text-[10px] uppercase tracking-wider text-fog-700 lg:hidden">Priority</span><PriorityBadge priority={t.priority} /></div>
          <div className="flex items-center justify-between gap-2 lg:block"><span className="text-[10px] uppercase tracking-wider text-fog-700 lg:hidden">Status</span><StatusBadge status={t.status} /></div>
          <div className="flex items-center justify-between gap-2 text-xs text-fog-400 lg:block"><span className="text-[10px] uppercase tracking-wider text-fog-700 lg:hidden">{scope === "mine" ? "Category" : "Requester"}</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-fog-600" />{scope === "mine" ? (t.category_name ?? "—") : (t.requester_name ?? "—")}</span></div>
          <div className="flex items-center justify-between gap-2 text-xs text-fog-400 lg:block"><span className="text-[10px] uppercase tracking-wider text-fog-700 lg:hidden">Needed by</span><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-fog-600" />{fmt(t.due_date)}</span></div>
        </Link>)}</div>}
    </section>
  </div>;
}