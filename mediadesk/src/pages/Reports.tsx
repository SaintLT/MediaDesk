import { useEffect, useMemo, useState } from "react";
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
  completed_at: string | null;
  requester_id: string | null;
  requester_department_id: string | null;
  category_id: string | null;
  assigned_to: string | null;
};
type Named = { id: string; name: string };
type Person = { id: string; full_name: string | null };

const CLOSED = ["completed", "cancelled"];
const STATUS_ORDER = ["submitted", "under_review", "assigned", "in_progress", "on_hold", "completed", "cancelled"];
const PRIORITY_ORDER = ["critical", "high", "medium", "low"];
const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

const pretty = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function rangeStart(key: string): number | null {
  if (key === "all") return null;
  if (key === "year") return new Date(new Date().getFullYear(), 0, 1).getTime();
  return Date.now() - Number(key) * 86400000;
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const hours = ms / 3600000;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

function avgDuration(list: Ticket[]): number | null {
  const spans = list
    .filter((t) => t.completed_at && t.submitted_at)
    .map((t) => new Date(t.completed_at!).getTime() - new Date(t.submitted_at!).getTime())
    .filter((n) => n >= 0);
  if (spans.length === 0) return null;
  return spans.reduce((a, b) => a + b, 0) / spans.length;
}

function countBy<T>(list: T[], keyFn: (t: T) => string) {
  const map = new Map<string, number>();
  list.forEach((t) => {
    const k = keyFn(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return map;
}

// Protects against spreadsheet formula injection and handles quotes/commas
function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone || "text-white"}`}>{value}</p>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No data for this period.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="truncate text-zinc-300">{r.label}</span>
                <span className="text-zinc-400">{r.value}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Reports() {
  const profile = useProfile();
  const canView = profile.role === "administrator";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Named[]>([]);
  const [departments, setDepartments] = useState<Named[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("30");

  useEffect(() => {
    if (!canView) return;
    let active = true;
    (async () => {
      const [t, c, d, p] = await Promise.all([
        supabase.from("tickets").select("*").order("submitted_at", { ascending: false }).limit(5000),
        supabase.from("ticket_categories").select("id, name"),
        supabase.from("departments").select("id, name"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (!active) return;
      const err = t.error ?? c.error ?? d.error ?? p.error;
      if (err) setError(err.message);
      else {
        setTickets((t.data ?? []) as Ticket[]);
        setCategories((c.data ?? []) as Named[]);
        setDepartments((d.data ?? []) as Named[]);
        setPeople((p.data ?? []) as Person[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [canView]);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const deptName = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.full_name ?? "Unnamed"])), [people]);

  const report = useMemo(() => {
    const start = rangeStart(range);
    const list = tickets.filter(
      (t) => start === null || (t.submitted_at !== null && new Date(t.submitted_at).getTime() >= start),
    );
    const today = new Date().toLocaleDateString("en-CA");
    const open = list.filter((t) => !CLOSED.includes(t.status));
    const completed = list.filter((t) => t.status === "completed");
    const overdue = open.filter((t) => t.due_date && t.due_date < today);

    const byStatus = countBy(list, (t) => t.status);
    const byPriority = countBy(list, (t) => t.priority);
    const byCategory = countBy(list, (t) => catName.get(t.category_id ?? "") ?? "Uncategorised");
    const byDept = countBy(list, (t) => deptName.get(t.requester_department_id ?? "") ?? "Unknown");

    const sortDesc = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const workloadIds = [...new Set(list.map((t) => t.assigned_to).filter((x): x is string => !!x))];
    const workload = workloadIds
      .map((id) => {
        const mine = list.filter((t) => t.assigned_to === id);
        return {
          id,
          name: personName.get(id) ?? "Unknown",
          active: mine.filter((t) => !CLOSED.includes(t.status)).length,
          completed: mine.filter((t) => t.status === "completed").length,
          avg: avgDuration(mine.filter((t) => t.status === "completed")),
        };
      })
      .sort((a, b) => b.active - a.active || b.completed - a.completed);

    return {
      list,
      total: list.length,
      open: open.length,
      completed: completed.length,
      overdue: overdue.length,
      rate: list.length ? Math.round((completed.length / list.length) * 100) : 0,
      avg: avgDuration(completed),
      statusRows: STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({ label: pretty(s), value: byStatus.get(s)! })),
      priorityRows: PRIORITY_ORDER.filter((p) => byPriority.has(p)).map((p) => ({ label: pretty(p), value: byPriority.get(p)! })),
      categoryRows: sortDesc(byCategory),
      deptRows: sortDesc(byDept),
      workload,
    };
  }, [tickets, range, catName, deptName, personName]);

  function exportCsv() {
    const header = [
      "Ticket", "Title", "Status", "Priority", "Category", "Department",
      "Requester", "Assigned to", "Submitted", "Due date", "Completed",
    ];
    const rows = report.list.map((t) => [
      t.ticket_number,
      t.title,
      pretty(t.status),
      pretty(t.priority),
      catName.get(t.category_id ?? "") ?? "",
      deptName.get(t.requester_department_id ?? "") ?? "",
      personName.get(t.requester_id ?? "") ?? "",
      personName.get(t.assigned_to ?? "") ?? "",
      t.submitted_at?.slice(0, 10) ?? "",
      t.due_date ?? "",
      t.completed_at?.slice(0, 10) ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mediadesk-report-${new Date().toLocaleDateString("en-CA")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canView) return <p className="p-6 text-sm text-zinc-400">You do not have access to this page.</p>;
  if (loading) return <p className="p-6 text-sm text-zinc-400">Loading reports…</p>;
  if (error) return <p className="p-6 text-sm text-red-400">Could not load reports: {error}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reports</h1>
          <p className="text-sm text-zinc-400">Based on tickets submitted in the selected period.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            disabled={report.total === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Tickets submitted" value={report.total} />
        <Stat label="Still open" value={report.open} tone="text-blue-400" />
        <Stat label="Completed" value={report.completed} />
        <Stat label="Completion rate" value={`${report.rate}%`} />
        <Stat label="Avg. time to complete" value={formatDuration(report.avg)} />
        <Stat label="Overdue" value={report.overdue} tone={report.overdue ? "text-red-400" : ""} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="By status" rows={report.statusRows} />
        <BarList title="By priority" rows={report.priorityRows} />
        <BarList title="By category" rows={report.categoryRows} />
        <BarList title="By requesting department" rows={report.deptRows} />
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Team workload</h2>
        {report.workload.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No assigned tickets in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="py-2 pr-4">Member</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Completed</th>
                  <th className="py-2">Avg. time to complete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {report.workload.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 pr-4 text-zinc-100">{w.name}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{w.active}</td>
                    <td className="py-2.5 pr-4 text-zinc-300">{w.completed}</td>
                    <td className="py-2.5 text-zinc-300">{formatDuration(w.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}