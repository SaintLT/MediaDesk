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
  "rounded-lg border border-charcoal-600 bg-charcoal-900 px-2 py-1.5 text-sm text-fog-100 outline-none focus:border-electric-400 disabled:cursor-not-allowed disabled:opacity-50";
const fieldClass =
  "w-full rounded-lg border border-charcoal-600 bg-charcoal-950 px-3 py-2 text-sm text-fog-100 outline-none focus:border-electric-400";

export default function Team() {
  const profile = useProfile();
  const canEdit = profile.role === "administrator";

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
      if (err) {
        setLoadError(err.message);
      } else {
        setMembers((p.data ?? []) as Member[]);
        const departments = (d.data ?? []) as Dept[];
        setDepts(departments);
        setNewDepartment(
          (current) => current || departments.find((department) => department.is_active)?.id || "",
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

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

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const fullName = newName.trim();
    const email = newEmail.trim().toLowerCase();

    if (fullName.length < 2) {
      setCreateError("Enter a full name of at least 2 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }
    if (!newDepartment || !depts.some((d) => d.id === newDepartment && d.is_active)) {
      setCreateError("Choose an active department.");
      return;
    }
    if (temporaryPassword.length < 10) {
      setCreateError("The temporary password must be at least 10 characters.");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create_user",
          email,
          full_name: fullName,
          department_id: newDepartment,
          role: newRole,
          password: temporaryPassword,
        },
      });

      if (error || data?.error) {
        setCreateError(data?.error ?? error?.message ?? "Could not create the account.");
        return;
      }

      const { data: refreshed, error: refreshError } = await supabase
        .from("profiles")
        .select(SELECT_COLS)
        .order("full_name");

      if (refreshError) {
        setCreateError("The account was created, but the team list could not refresh. Reload this page.");
      } else {
        setMembers((refreshed ?? []) as Member[]);
        setCreateSuccess(
          "Account created for " + fullName + ". They can sign in with their email and temporary password.",
        );
      }

      setNewName("");
      setNewEmail("");
      setTemporaryPassword("");
      setNewRole("normal_user");
      setCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setCreating(false);
    }
  }

  function toggleActive(m: Member) {
    if (m.is_active && !window.confirm("Deactivate " + (m.full_name ?? m.email) + "? They will no longer be able to use MediaDesk.")) {
      return;
    }
    void save(m.id, { is_active: !m.is_active });
  }

  if (!canEdit) return <p className="p-6 text-sm text-fog-500">You do not have access to this page.</p>;
  if (loading) return <p className="p-6 text-sm text-fog-500">Loading team…</p>;
  if (loadError) return <p className="p-6 text-sm text-red-400">Could not load team: {loadError}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-fog-100">Team</h1>
        <p className="text-sm text-fog-500">
          {members.length} members · {members.filter((m) => m.is_active).length} active
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCreateOpen((open) => !open);
            setCreateError(null);
            setCreateSuccess(null);
          }}
          className="rounded-lg bg-electric-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-electric-400"
        >
          {createOpen ? "Close form" : "Create account"}
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="w-full max-w-xs rounded-lg border border-charcoal-600 bg-charcoal-900 px-3 py-2 text-sm text-fog-100 outline-none focus:border-electric-400"
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

      {createSuccess && (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {createSuccess}
        </p>
      )}

      {createOpen && (
        <form onSubmit={createAccount} className="grid gap-4 rounded-2xl border border-charcoal-700 bg-charcoal-950 shadow-card p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="new-member-name" className="mb-1 block text-sm font-medium text-fog-300">Full name</label>
            <input
              id="new-member-name"
              required
              minLength={2}
              maxLength={120}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={fieldClass}
              placeholder="Full name"
            />
          </div>
          <div>
            <label htmlFor="new-member-email" className="mb-1 block text-sm font-medium text-fog-300">Email address</label>
            <input
              id="new-member-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={fieldClass}
              placeholder="person@example.com"
            />
          </div>
          <div>
            <label htmlFor="new-member-department" className="mb-1 block text-sm font-medium text-fog-300">Active department</label>
            <select
              id="new-member-department"
              required
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              className={fieldClass}
            >
              <option value="">Choose department</option>
              {depts.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-member-role" className="mb-1 block text-sm font-medium text-fog-300">Role</label>
            <select id="new-member-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} className={fieldClass}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="new-member-password" className="mb-1 block text-sm font-medium text-fog-300">Temporary password</label>
            <input
              id="new-member-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              className={fieldClass}
              placeholder="At least 10 characters"
            />
            <p className="mt-1 text-xs text-fog-500">
              Share this password with the new user securely. They can change it later in Settings.
            </p>
          </div>
          {createError && <p role="alert" className="sm:col-span-2 text-sm text-red-400">{createError}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={creating || !depts.some((d) => d.is_active)}
              className="rounded-lg bg-electric-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-electric-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating account…" : "Create account"}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-charcoal-600 px-4 py-2 text-sm text-fog-300 hover:bg-charcoal-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-charcoal-700 bg-charcoal-900/70">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-charcoal-700 text-xs uppercase tracking-wide text-fog-500">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-700">
            {visible.map((m) => {
              const isSelf = m.id === profile.id;
              const locked = savingId === m.id;
              return (
                <tr key={m.id} className={m.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-fog-100">
                      {m.full_name ?? "—"} {isSelf && <span className="text-xs text-blue-400">(you)</span>}
                    </p>
                    <p className="text-xs text-fog-500">{m.email}</p>
                    {rowError?.id === m.id && <p className="mt-1 text-xs text-red-400">{rowError.message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      disabled={locked || isSelf}
                      onChange={(e) => void save(m.id, { role: e.target.value })}
                      className={selectClass}
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.department_id ?? ""}
                      disabled={locked}
                      onChange={(e) => void save(m.id, { department_id: e.target.value || null })}
                      className={selectClass}
                    >
                      <option value="">No department</option>
                      {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={locked || isSelf}
                      onClick={() => toggleActive(m)}
                      className={
                        "rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed " +
                        (m.is_active
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-zinc-600 bg-charcoal-800 text-fog-500")
                      }
                    >
                      {m.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fog-500">
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