import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useProfile } from "@/contexts/AuthContext";
import { PriorityBadge, StatusBadge } from "@/components/tickets/Badges";
import {
  FILE_ACCEPT,
  MAX_FILES,
  addComment,
  deleteAttachment,
  fetchActivity,
  fetchAssignableMembers,
  fetchAttachments,
  fetchComments,
  fetchTicket,
  fetchTicketDeliverables,
  formatBytes,
  getAttachmentUrl,
  updateTicket,
  uploadAttachments,
  validateFiles,
} from "@/lib/tickets";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type Status,
} from "@/types/db";
import type {
  ActivityEntry,
  AttachmentEntry,
  CommentEntry,
  TeamMember,
  Ticket,
  TicketUpdate,
} from "@/types/ticket";

const field =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40";
const button =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60";
const label = "mb-1 block text-sm font-medium text-zinc-300";
const formBox = "space-y-2 border-t border-zinc-800 pt-4 first:border-0 first:pt-0";

const NOTE_MIN = 5;

const fmtDateTime = (d: string) => new Date(d).toLocaleString();
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";

function messageOf(err: unknown, fallback: string): string {
  return (err as { message?: string } | null)?.message || fallback;
}

function statusLabel(value: string | null): string {
  return (value && STATUS_LABELS[value as Status]) || value || "—";
}

function priorityLabel(value: string | null): string {
  return (value && PRIORITY_LABELS[value as Priority]) || value || "—";
}

function describeActivity(a: ActivityEntry): string {
  switch (a.type) {
    case "created":
      return "created the ticket";
    case "status_changed":
      return `changed the status from ${statusLabel(a.old_value)} to ${statusLabel(a.new_value)}`;
    case "priority_changed":
      return `changed the priority from ${priorityLabel(a.old_value)} to ${priorityLabel(a.new_value)}`;
    case "assigned":
      return a.old_value
        ? `reassigned the ticket from ${a.old_value} to ${a.new_value ?? "someone"}`
        : `assigned the ticket to ${a.new_value ?? "someone"}`;
    case "unassigned":
      return a.old_value ? `unassigned the ticket from ${a.old_value}` : "unassigned the ticket";
    case "due_date_changed":
      return `changed the needed-by date from ${a.old_value ?? "none"} to ${a.new_value ?? "none"}`;
    case "category_changed":
      return `changed the category from ${a.old_value ?? "none"} to ${a.new_value ?? "none"}`;
    case "comment_added":
      return "added a comment";
    case "attachment_added":
      return "added an attachment";
    default:
      return a.type.replace(/_/g, " ");
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-zinc-500">{name}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useProfile();
  const isManager = profile.role === "administrator";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(() => {
    const state = location.state as { warning?: string } | null;
    return state?.warning ?? null;
  });
  const [notice, setNotice] = useState<string | null>(null);

  const [statusChoice, setStatusChoice] = useState("");
  const [resolution, setResolution] = useState("");
  const [priorityChoice, setPriorityChoice] = useState<Priority>("medium");
  const [assigneeChoice, setAssigneeChoice] = useState("");
  const [commentText, setCommentText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [t, a, c, m, d, f] = await Promise.all([
        fetchTicket(id),
        fetchActivity(id),
        fetchComments(id),
        isManager ? fetchAssignableMembers() : Promise.resolve([] as TeamMember[]),
        fetchTicketDeliverables(id),
        fetchAttachments(id),
      ]);
      setTicket(t);
      setActivity(a);
      setComments(c);
      setMembers(m);
      setDeliverables(d);
      setAttachments(f);
      if (t) {
        setPriorityChoice(t.priority);
        setAssigneeChoice(t.assigned_to ?? "");
        setResolution(t.resolution_note ?? "");
        setStatusChoice("");
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(messageOf(err, "Could not load this ticket."));
    }
  }, [id, isManager]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <p className="text-sm text-zinc-500">Loading ticket…</p>;

  if (loadError) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
      >
        {loadError}
      </p>
    );
  }

  if (!ticket) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white">Ticket not found</h1>
        <p className="mt-1 text-sm text-zinc-400">
          It may not exist, or you may not have access to it.
        </p>
        <button type="button" onClick={() => navigate(-1)} className={`${button} mt-4`}>
          Go back
        </button>
      </div>
    );
  }

  // What this person may do, matching the database rules.
  const isRequester = ticket.requester_id === profile.id;
  const canAttach = isManager || isRequester;

  let statusOptions: Status[] = [];
  if (isManager) {
    statusOptions = STATUSES.filter((s) => s !== ticket.status);
  } else if (isRequester) {
    statusOptions =
      ticket.status === "submitted" || ticket.status === "under_review" ? ["cancelled"] : [];
  }
  const canManage = isManager || statusOptions.length > 0;

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      await load();
      setNotice(success);
    } catch (err) {
      setActionError(messageOf(err, "That change could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  function submitStatus(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !statusChoice) return;
    const next = statusChoice as Status;
    const patch: TicketUpdate = { status: next };

    if (next === "completed") {
      if (resolution.trim().length < NOTE_MIN) {
        setActionError(
          `Add a resolution note of at least ${NOTE_MIN} characters to complete the ticket.`
        );
        return;
      }
      patch.resolution_note = resolution.trim();
    }
    if ((next === "assigned" || next === "in_progress") && !ticket.assigned_to) {
      setActionError("Assign the ticket to a team member first.");
      return;
    }
    void run(() => updateTicket(ticket.id, patch), `Status changed to ${STATUS_LABELS[next]}.`);
  }

  function submitPriority(e: FormEvent) {
    e.preventDefault();
    if (!ticket || priorityChoice === ticket.priority) return;
    void run(
      () => updateTicket(ticket.id, { priority: priorityChoice }),
      `Priority changed to ${PRIORITY_LABELS[priorityChoice]}.`
    );
  }

  function submitAssignment(e: FormEvent) {
    e.preventDefault();
    if (!ticket || assigneeChoice === (ticket.assigned_to ?? "")) return;
    void run(
      () => updateTicket(ticket.id, { assigned_to: assigneeChoice || null }),
      assigneeChoice ? "Ticket assigned." : "Ticket unassigned."
    );
  }

  function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !commentText.trim()) return;
    void run(async () => {
      await addComment(ticket.id, commentText);
      setCommentText("");
    }, "Comment added.");
  }

  function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";
    const { accepted, errors } = validateFiles(pendingFiles, incoming);
    setPendingFiles((current) => [...current, ...accepted]);
    setFileErrors(errors);
  }

  async function submitFiles() {
    if (!ticket || pendingFiles.length === 0) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const failures = await uploadAttachments(ticket.id, pendingFiles);
      setPendingFiles([]);
      await load();
      if (failures.length > 0) {
        setActionError(`These files could not be uploaded: ${failures.join("; ")}.`);
      } else {
        setNotice("Files uploaded.");
      }
    } catch (err) {
      setActionError(messageOf(err, "The files could not be uploaded."));
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment(a: AttachmentEntry) {
    try {
      const url = await getAttachmentUrl(a.file_path, a.file_name);
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setActionError(messageOf(err, "Could not open this file."));
    }
  }

  function removeAttachment(a: AttachmentEntry) {
    if (!window.confirm(`Remove ${a.file_name}?`)) return;
    void run(() => deleteAttachment(a), "File removed.");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← Back
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-blue-400">{ticket.ticket_number}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{ticket.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {actionError}
        </p>
      )}
      {notice && !actionError && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{ticket.description}</p>
          </Card>

          {deliverables.length > 0 && (
            <Card title="Deliverables requested">
              <div className="flex flex-wrap gap-2">
                {deliverables.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-200"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card title={`Attachments (${attachments.length})`}>
            {attachments.length === 0 ? (
              <p className="text-sm text-zinc-500">No files attached.</p>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => void openAttachment(a)}
                        className="block max-w-full truncate text-left font-medium text-blue-400 hover:text-blue-300"
                      >
                        {a.file_name}
                      </button>
                      <p className="text-xs text-zinc-500">
                        {formatBytes(a.file_size)} · {a.uploader_name ?? "Unknown user"} ·{" "}
                        {fmtDateTime(a.created_at)}
                      </p>
                    </div>
                    {(isManager || a.uploaded_by === profile.id) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeAttachment(a)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-300 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canAttach && (
              <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
                <label htmlFor="attach" className={label}>
                  Add files
                </label>
                <input
                  id="attach"
                  type="file"
                  multiple
                  accept={FILE_ACCEPT}
                  onChange={pickFiles}
                  disabled={busy || pendingFiles.length >= MAX_FILES}
                  className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-zinc-200 hover:file:bg-zinc-700 disabled:opacity-50"
                />
                <p className="text-xs text-zinc-500">
                  Up to {MAX_FILES} files at a time, 10 MB each.
                </p>
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1">
                    {pendingFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm"
                      >
                        <span className="truncate text-zinc-200">
                          {f.name} <span className="text-zinc-500">· {formatBytes(f.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingFiles((current) => current.filter((_, idx) => idx !== i));
                            setFileErrors([]);
                          }}
                          className="shrink-0 text-xs text-zinc-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {fileErrors.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-red-300">
                    {fileErrors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
                {pendingFiles.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => void submitFiles()}
                    >
                      {busy ? "Uploading…" : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {ticket.resolution_note && (
            <Card title="Resolution note">
              <p className="whitespace-pre-wrap text-sm text-zinc-300">{ticket.resolution_note}</p>
            </Card>
          )}

          <Card title={`Comments (${comments.length})`}>
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comments yet.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="text-zinc-400">
                      <span className="font-medium text-zinc-100">{c.author_name ?? "Unknown user"}</span>
                      {" · "}
                      {fmtDateTime(c.created_at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-zinc-300">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={submitComment} className="mt-4 space-y-2">
              <label htmlFor="comment" className="sr-only">
                Add a comment
              </label>
              <textarea
                id="comment"
                rows={3}
                className={field}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
              />
              <div className="flex justify-end">
                <button type="submit" className={button} disabled={busy || !commentText.trim()}>
                  Add comment
                </button>
              </div>
            </form>
          </Card>

          <Card title="Activity">
            {activity.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                    <div>
                      <p className="text-zinc-300">
                        <span className="font-medium text-zinc-100">{a.actor_name ?? "System"}</span>{" "}
                        {describeActivity(a)}
                      </p>
                      {a.note && a.type !== "created" && (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-500">{a.note}</p>
                      )}
                      <p className="text-xs text-zinc-500">{fmtDateTime(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <dl className="divide-y divide-zinc-900">
              <Row name="Category">{ticket.category_name}</Row>
              {ticket.ministry_name && <Row name="Ministry">{ticket.ministry_name}</Row>}
              <Row name="Requester">
                {ticket.requester_name ?? "—"}
                {ticket.requester_department && (
                  <span className="block text-xs text-zinc-500">{ticket.requester_department}</span>
                )}
              </Row>
              {ticket.requested_for && <Row name="On behalf of">{ticket.requested_for}</Row>}
              <Row name="Assigned to">{ticket.assignee_name ?? "Unassigned"}</Row>
              <Row name="Needed by">{fmtDate(ticket.due_date)}</Row>
              {ticket.event_date && <Row name="Event date">{fmtDate(ticket.event_date)}</Row>}
              {ticket.suggested_priority !== ticket.priority && (
                <Row name="Requested priority">{PRIORITY_LABELS[ticket.suggested_priority]}</Row>
              )}
              <Row name="Submitted">{fmtDateTime(ticket.submitted_at)}</Row>
              <Row name="Last updated">{fmtDateTime(ticket.updated_at)}</Row>
            </dl>
          </Card>

          {canManage && (
            <Card title={isManager ? "Manage ticket" : "Actions"}>
              <div>
                {isManager && (
                  <form onSubmit={submitAssignment} className={formBox}>
                    <label htmlFor="assignee" className={label}>
                      Assign to
                    </label>
                    <select
                      id="assignee"
                      className={field}
                      value={assigneeChoice}
                      onChange={(e) => setAssigneeChoice(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500">
                      Assigning a new ticket moves it to Assigned automatically.
                    </p>
                    <button
                      type="submit"
                      className={button}
                      disabled={busy || assigneeChoice === (ticket.assigned_to ?? "")}
                    >
                      Save assignment
                    </button>
                  </form>
                )}

                {isManager && (
                  <form onSubmit={submitPriority} className={formBox}>
                    <label htmlFor="priority" className={label}>
                      Priority
                    </label>
                    <select
                      id="priority"
                      className={field}
                      value={priorityChoice}
                      onChange={(e) => setPriorityChoice(e.target.value as Priority)}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className={button}
                      disabled={busy || priorityChoice === ticket.priority}
                    >
                      Update priority
                    </button>
                  </form>
                )}

                {statusOptions.length > 0 && (
                  <form onSubmit={submitStatus} className={formBox}>
                    <label htmlFor="status" className={label}>
                      Change status
                    </label>
                    <select
                      id="status"
                      className={field}
                      value={statusChoice}
                      onChange={(e) => setStatusChoice(e.target.value)}
                    >
                      <option value="">Select a status…</option>
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>

                    {statusChoice === "completed" && (
                      <div>
                        <label htmlFor="resolution" className={label}>
                          Resolution note
                        </label>
                        <textarea
                          id="resolution"
                          rows={3}
                          className={field}
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          placeholder="What was done to resolve this?"
                        />
                        <p className="mt-1 text-xs text-zinc-500">
                          Required, at least {NOTE_MIN} characters.
                        </p>
                      </div>
                    )}

                    <button type="submit" className={button} disabled={busy || !statusChoice}>
                      Update status
                    </button>
                  </form>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}