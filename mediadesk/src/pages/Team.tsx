import { useEffect, useMemo, useState, type FormEvent } from "react";
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
type Dept = { id: string; name: string; is_active: boolean };

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
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newRole, setNewRole] = useState("normal_user");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from("profiles").select(SELECT_COLS).order("full_name"),
        supabase.from("departments").select("id, name, is_active").order("name"),
      ]);
      if (!active) return;
      const err = p.error ?? d.error;
      if (err) setLoadError(err.message);
      else {
        setMembers((p.data ?? []) as Member[]);
        const departments = (d.data ?? []) as Dept[];\n        setDepts(departments);\n        setNewDepartment((current) => current || departments.find((department) => department.is_active)?.id || "");
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

  async function createAccount(e: FormEvent<HTMLFormElement>) {\n    e.preventDefault();\n    setCreateError(null);\n    setCreateSuccess(null);\n    const fullName = newName.trim();\n    const email = newEmail.trim().toLowerCase();\n    if (fullName.length < 2) {\n      setCreateError("Enter a full name of at least 2 characters.");\n      return;\n    }\n    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n      setCreateError("Enter a valid email address.");\n      return;\n    }\n    if (!newDepartment || !depts.some((department) => department.id === newDepartment && department.is_active)) {\n      setCreateError("Choose an active department.");\n      return;\n    }\n    if (temporaryPassword.length < 10) {\n      setCreateError("The temporary password must be at least 10 characters.");\n      return;\n    }\n\n    setCreating(true);\n    const { data, error } = await supabase.functions.invoke("admin-users", {\n      body: {\n        action: "create_user",\n        email,\n        full_name: fullName,\n        department_id: newDepartment,\n        role: newRole,\n        password: temporaryPassword,\n      },\n    });\n    setCreating(false);\n    if (error || data?.error) {\n      setCreateError(data?.error ?? error?.message ?? "Could not create the account.");\n      return;\n    }\n\n    const { data: refreshed, error: refreshError } = await supabase\n      .from("profiles")\n      .select(SELECT_COLS)\n      .order("full_name");\n    if (refreshError) {\n      setCreateError("The account was created, but the team list could not refresh. Reload this page.");\n    } else {\n      setMembers((refreshed ?? []) as Member[]);\n      setCreateSuccess(`Account created for ${fullName}. They can sign in with their email and temporary password.`);\n    }\n    setNewName("");\n    setNewEmail("");\n    setTemporaryPassword("");\n    setNewRole("normal_user");\n    setCreateOpen(false);\n  }\n\n  function toggleActive(m: Member) {
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

      <div className="flex flex-wrap items-center gap-3">\n        <button\n          type="button"\n          onClick={() => { setCreateOpen((open) => !open); setCreateError(null); setCreateSuccess(null); }}\n          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"\n        >\n          {createOpen ? "Close form" : "Create account"}\n        </button>
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

      {createSuccess && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{createSuccess}</p>}\n\n      {createOpen && (\n        <form onSubmit={createAccount} className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:grid-cols-2">\n          <div>\n            <label htmlFor="new-member-name" className="mb-1 block text-sm font-medium text-zinc-300">Full name</label>\n            <input id="new-member-name" required minLength={2} maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500" placeholder="Full name" />\n          </div>\n          <div>\n            <label htmlFor="new-member-email" className="mb-1 block text-sm font-medium text-zinc-300">Email address</label>\n            <input id="new-member-email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500" placeholder="person@example.com" />\n          </div>\n          <div>\n            <label htmlFor="new-member-department" className="mb-1 block text-sm font-medium text-zinc-300">Active department</label>\n            <select id="new-member-department" required value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className={`${selectClass} w-full`}>\n              <option value="">Choose department</option>\n              {depts.filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}\n            </select>\n          </div>\n          <div>\n            <label htmlFor="new-member-role" className="mb-1 block text-sm font-medium text-zinc-300">Role</label>\n            <select id="new-member-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} className={`${selectClass} w-full`}>\n              {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}\n            </select>\n          </div>\n          <div className="sm:col-span-2">\n            <label htmlFor="new-member-password" className="mb-1 block text-sm font-medium text-zinc-300">Temporary password</label>\n            <input id="new-member-password" type="password" autoComplete="new-password" required minLength={10} value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500" placeholder="At least 10 characters" />\n            <p className="mt-1 text-xs text-zinc-500">Share this password with the new user securely. They can change it later in Settings.</p>\n          </div>\n          {createError && <p role="alert" className="sm:col-span-2 text-sm text-red-400">{createError}</p>}\n          <div className="flex flex-wrap gap-2 sm:col-span-2">\n            <button type="submit" disabled={creating || depts.every((department) => !department.is_active)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{creating ? "Creating account…" : "Create account"}</button>\n            <button type="button" disabled={creating} onClick={() => setCreateOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">Cancel</button>\n          </div>\n        </form>\n      )}\n\n      <div className="flex flex-wrap gap-3">\n        <input
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