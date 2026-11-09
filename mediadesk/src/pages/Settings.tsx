import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/types/db";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Monitor } from "lucide-react";

const field =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";
const button =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60";
const smallButton =
  "rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const label = "mb-1 block text-sm font-medium text-zinc-300";

const PASSWORD_MIN = 8;

interface Department {
  id: string;
  name: string;
}
interface MinistryRow {
  id: string;
  department_id: string;
  name: string;
  is_active: boolean;
}
interface DeliverableRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}
type Notify = (kind: "ok" | "error", text: string) => void;

function friendlyError(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "23505") return "That name already exists.";
  if (e?.code === "23514") return "Names must be between 2 and 120 characters.";
  return e?.message || fallback;
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EditableRow({
  name,
  active,
  busy,
  onRename,
  onToggle,
}: {
  name: string;
  active: boolean;
  busy: boolean;
  onRename: (next: string) => Promise<boolean>;
  onToggle: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      setDraft(name);
      setEditing(false);
      return;
    }
    if (await onRename(next)) setEditing(false);
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      {editing ? (
        <input
          aria-label="Name"
          className={field}
          value={draft}
          maxLength={120}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className={`min-w-0 truncate text-sm ${active ? "text-zinc-100" : "text-zinc-500 line-through"}`}>
          {name}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            <button type="button" className={smallButton} disabled={busy} onClick={() => void save()}>
              Save
            </button>
            <button
              type="button"
              className={smallButton}
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className={smallButton} disabled={busy} onClick={() => setEditing(true)}>
              Rename
            </button>
            <button type="button" className={smallButton} disabled={busy} onClick={() => void onToggle()}>
              {active ? "Disable" : "Enable"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function MinistriesCard({ notify }: { notify: Notify }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ministries, setMinistries] = useState<MinistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const [deptRes, minRes] = await Promise.all([
      supabase.from("departments").select("id, name").order("name", { ascending: true }),
      supabase
        .from("ministries")
        .select("id, department_id, name, is_active")
        .order("name", { ascending: true }),
    ]);
    if (deptRes.error) throw deptRes.error;
    if (minRes.error) throw minRes.error;
    const depts = (deptRes.data ?? []) as Department[];
    setDepartments(depts);
    setMinistries((minRes.data ?? []) as MinistryRow[]);
    setDepartmentId((current) => current || depts[0]?.id || "");
  }, []);

  useEffect(() => {
    load()
      .catch((err) => notify("error", friendlyError(err, "Could not load ministries.")))
      .finally(() => setLoading(false));
  }, [load, notify]);

  async function update(id: string, changes: Partial<MinistryRow>): Promise<boolean> {
    setBusy(true);
    try {
      const { data, error } = await supabase.from("ministries").update(changes).eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You do not have permission to change this.");
      await load();
      return true;
    } catch (err) {
      notify("error", friendlyError(err, "That change could not be saved."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!departmentId || trimmed.length < 2) {
      notify("error", "Choose a department and enter a ministry name of at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("ministries")
        .insert({ department_id: departmentId, name: trimmed });
      if (error) throw error;
      setName("");
      await load();
      notify("ok", `Ministry "${trimmed}" added.`);
    } catch (err) {
      notify("error", friendlyError(err, "The ministry could not be added."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Ministries"
      description="Ministries belong to a department and appear on the Submit Ticket form. Disabling one hides it from new tickets but keeps it on old ones."
    >
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
        <div>
          <label htmlFor="ministry-department" className={label}>
            Department
          </label>
          <select
            id="ministry-department"
            className={field}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ministry-name" className={label}>
            Ministry name
          </label>
          <input
            id="ministry-name"
            className={field}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Choir"
          />
        </div>
        <button type="submit" className={button} disabled={busy || !departmentId}>
          Add
        </button>
      </form>

      <div className="mt-5 space-y-4">
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {!loading && departments.length === 0 && (
          <p className="text-sm text-zinc-500">No departments found.</p>
        )}
        {departments.map((d) => {
          const items = ministries.filter((m) => m.department_id === d.id);
          return (
            <div key={d.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{d.name}</h3>
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-zinc-600">No ministries yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-900">
                  {items.map((m) => (
                    <EditableRow
                      key={m.id}
                      name={m.name}
                      active={m.is_active}
                      busy={busy}
                      onRename={(next) => update(m.id, { name: next })}
                      onToggle={() => update(m.id, { is_active: !m.is_active })}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DeliverablesCard({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("deliverable_types")
      .select("id, name, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    setRows((data ?? []) as DeliverableRow[]);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => notify("error", friendlyError(err, "Could not load deliverable types.")))
      .finally(() => setLoading(false));
  }, [load, notify]);

  async function update(id: string, changes: Partial<DeliverableRow>): Promise<boolean> {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("deliverable_types")
        .update(changes)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You do not have permission to change this.");
      await load();
      return true;
    } catch (err) {
      notify("error", friendlyError(err, "That change could not be saved."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      notify("error", "Enter a name of at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      const nextOrder = rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;
      const { error } = await supabase
        .from("deliverable_types")
        .insert({ name: trimmed, sort_order: nextOrder });
      if (error) throw error;
      setName("");
      await load();
      notify("ok", `Deliverable type "${trimmed}" added.`);
    } catch (err) {
      notify("error", friendlyError(err, "The deliverable type could not be added."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Deliverable types"
      description="The items people can tick on the Submit Ticket form, such as Poster or Banner."
    >
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="deliverable-name" className={label}>
            New deliverable type
          </label>
          <input
            id="deliverable-name"
            className={field}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brochure"
          />
        </div>
        <button type="submit" className={button} disabled={busy}>
          Add
        </button>
      </form>

      <ul className="mt-5 divide-y divide-zinc-900">
        {loading && <li className="py-2 text-sm text-zinc-500">Loading…</li>}
        {rows.map((r) => (
          <EditableRow
            key={r.id}
            name={r.name}
            active={r.is_active}
            busy={busy}
            onRename={(next) => update(r.id, { name: next })}
            onToggle={() => update(r.id, { is_active: !r.is_active })}
          />
        ))}
      </ul>
    </Card>
  );
}


function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <Card title="Appearance" description="Choose how MediaDesk looks on this device. Your preference is saved automatically.">
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { value: "light" as const, label: "Light", description: "Bright, crisp and easy to read", Icon: Sun },
          { value: "dark" as const, label: "Dark", description: "Low-glare workspace for focused work", Icon: Moon },
        ]).map(({ value, label: optionLabel, description, Icon }) => (
          <button key={value} type="button" onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 ${theme === value ? "border-electric-400 bg-electric-500/10 ring-2 ring-electric-500/15" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${theme === value ? "bg-electric-500 text-white" : "bg-zinc-800 text-zinc-300"}`}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-zinc-100">{optionLabel}</span><span className="mt-0.5 block text-xs text-zinc-500">{description}</span></span>
            <span className={`h-2.5 w-2.5 rounded-full ${theme === value ? "bg-electric-400" : "bg-zinc-700"}`} />
          </button>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><Monitor className="h-3.5 w-3.5" /> Applies across the whole application.</p>
    </Card>
  );
}

function PasswordCard({ notify }: { notify: Notify }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) {
      notify("error", `Your new password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      notify("error", "The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      notify("ok", "Your password has been changed.");
    } catch (err) {
      notify("error", friendlyError(err, "The password could not be changed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="new-password" className={label}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={label}>
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className={field}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <p className="text-xs text-zinc-500">At least {PASSWORD_MIN} characters.</p>
        <button type="submit" className={button} disabled={busy || !password || !confirm}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}

export default function Settings() {
  const profile = useProfile();
  const isAdmin = profile.role === "administrator";
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const notify = useCallback<Notify>((kind, text) => setMessage({ kind, text }), []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isAdmin
            ? "Manage your account and the lists used across MediaDesk."
            : "Manage your account."}
        </p>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {message.text}
        </p>
      )}

      <Card title="Account">
        <dl className="divide-y divide-zinc-900 text-sm">
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-200">{profile.full_name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{profile.email}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-zinc-500">Role</dt>
            <dd className="text-zinc-200">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-zinc-500">Department</dt>
            <dd className="text-zinc-200">{profile.department?.name ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          To change your name, role or department, ask an administrator.
        </p>
      </Card>

      <AppearanceCard />
      <PasswordCard notify={notify} />

      {isAdmin && <MinistriesCard notify={notify} />}
      {isAdmin && <DeliverablesCard notify={notify} />}
    </div>
  );
}