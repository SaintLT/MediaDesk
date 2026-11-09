import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/AuthContext";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  role: string;
  is_active: boolean;
};
type Dept = { id: string; name: string };

const ROLES = [
  { value: "administrator", label: "Administrator" },
  { value: "normal_user", label: "Normal User" },
];
const SELECT_COLS = "id, full_name, email, department_id, role, is_active";
const selectClass =
  "rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export default function Team() {
  const profile = useProfile();
  const canEdit = profile.role === "administrator";
  const canView = canEdit;

  const [members, setMembers] = useState<Member[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from("profiles").select(SELECT_COLS).order("full_name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      if (!active) return;
      const err = p.error ?? d.error;
      if (err) setLoadError(err.message);
      else {
        setMembers((p.data ?? []) as Member[]);
        setDepts((d.data ?? []) as Dept[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
    });
  }, [members, search, roleFilter]);

  async function save(id: string, patch: Partial<Pick<Member, "role" | "department_id" | "is_active">>) {
    setSavingId(id);
    setRowError(null);
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();
    setSavingId(null);
    if (error) {
      setRowError({ id, message: error.message });
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? (data as Member) : m)));
  }

  function toggleActive(m: Member) {
    if (m.is_active && !window.confirm(`Deactivate ${m.full_name ?? m.email}? They will no longer be able to use MediaDesk.`)) return;
    save(m.id, { is_active: !m.is_active });
  }

  if (!canView) return <p className="p-6 text-sm text-zinc-400">You do not have access to this page.</p>;
  if (loading) return <p className="p-6 text-sm text-zinc-400">Loading team…</p>;
  if (loadError) return <p className="p-6 text-sm text-red-400">Could not load team: {loadError}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Team</h1>
        <p className="text-sm text-zinc-400">
          {members.length} members · {members.filter((m) => m.is_active).length} active
          {!canEdit && " · view only"}
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {visible.map((m) => {
              const isSelf = m.id === profile.id;
              const locked = !canEdit || savingId === m.id;
              return (
                <tr key={m.id} className={m.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">
                      {m.full_name ?? "—"} {isSelf && <span className="text-xs text-blue-400">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{m.email}</p>
                    {rowError?.id === m.id && <p className="mt-1 text-xs text-red-400">{rowError.message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      disabled={locked || isSelf}
                      onChange={(e) => save(m.id, { role: e.target.value })}
                      className={selectClass}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        value={m.department_id ?? ""}
                        disabled={locked}
                        onChange={(e) => save(m.id, { department_id: e.target.value || null })}
                        className={selectClass}
                      >
                        <option value="">No department</option>
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-zinc-300">{deptName.get(m.department_id ?? "") ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={locked || isSelf}
                      onClick={() => toggleActive(m)}
                      className={`rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed ${
                        m.is_active
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-zinc-600 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {m.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No members match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}