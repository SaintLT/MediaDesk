import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTickets } from "@/lib/tickets";
import { PriorityBadge, StatusBadge } from "@/components/tickets/Badges";
import { STATUSES, STATUS_LABELS } from "@/types/db";
import type { Ticket, TicketScope } from "@/types/ticket";

interface Props {
  scope: TicketScope;
  title: string;
  subtitle?: string;
}

const field =
  "rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

export default function TicketList({ scope, title, subtitle }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTickets(scope)
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Could not load tickets.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q) ||
        (t.requester_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, search, statusFilter]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="Search tickets"
          className={`${field} sm:w-72`}
          placeholder="Search by title, number or requester"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className={field}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {scope !== "mine" && <th className="px-4 py-3 font-medium">Requester</th>}
              <th className="px-4 py-3 font-medium">Assigned to</th>
              <th className="px-4 py-3 font-medium">Needed by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  Loading tickets…
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  {tickets.length === 0 ? "No tickets yet." : "No tickets match your filters."}
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((t) => (
                <tr key={t.id} className="transition hover:bg-zinc-900/60">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-blue-400">
                    <Link to={`/tickets/${t.id}`} className="hover:underline">
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-100">
                    <Link to={`/tickets/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  {scope !== "mine" && (
                    <td className="px-4 py-3 text-zinc-300">
                      {t.requester_name ?? "—"}
                      {t.requester_department && (
                        <span className="block text-xs text-zinc-500">{t.requester_department}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-zinc-300">{t.assignee_name ?? "Unassigned"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{fmt(t.due_date)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}