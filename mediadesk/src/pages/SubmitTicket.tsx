import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  FILE_ACCEPT,
  MAX_FILES,
  createTicket,
  fetchCategories,
  fetchDeliverableTypes,
  fetchMinistries,
  formatBytes,
  uploadAttachments,
  validateFiles,
} from "@/lib/tickets";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/types/db";
import type { Category, DeliverableType, Ministry } from "@/types/ticket";

const field =
  "w-full rounded-xl border border-charcoal-700 bg-charcoal-900 px-3 py-3 text-sm text-fog-100 placeholder-zinc-500 focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-500/20";
const label = "mb-2 block text-xs font-semibold uppercase tracking-wider text-fog-500";

// These match the length rules enforced by the database.
const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 10000;

function messageOf(err: unknown, fallback: string): string {
  return (err as { message?: string } | null)?.message || fallback;
}

export default function SubmitTicket() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [deliverableTypes, setDeliverableTypes] = useState<DeliverableType[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [requiredDate, setRequiredDate] = useState("");
  const [ministryId, setMinistryId] = useState("");
  const [requestedFor, setRequestedFor] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [deliverableIds, setDeliverableIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(), fetchMinistries(), fetchDeliverableTypes()])
      .then(([cats, mins, types]) => {
        if (cancelled) return;
        setCategories(cats);
        setCategoryId((current) => current || cats[0]?.id || "");
        setMinistries(mins);
        setDeliverableTypes(types);
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err, "Could not load the form options."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Group ministries under their department for the dropdown.
  const ministryGroups = ministries.reduce<Record<string, Ministry[]>>((groups, m) => {
    const key = m.department_name ?? "Other";
    (groups[key] ??= []).push(m);
    return groups;
  }, {});

  function toggleDeliverable(id: string) {
    setDeliverableIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";
    const { accepted, errors } = validateFiles(pendingFiles, incoming);
    setPendingFiles((current) => [...current, ...accepted]);
    setFileErrors(errors);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (title.trim().length < TITLE_MIN) {
      setError(`Please enter a title of at least ${TITLE_MIN} characters.`);
      return;
    }
    if (!categoryId) {
      setError("Please choose a category.");
      return;
    }
    if (description.trim().length < DESCRIPTION_MIN) {
      setError(
        `Please describe your request in at least ${DESCRIPTION_MIN} characters so the team can help.`
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const created = await createTicket({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        priority,
        due_date: requiredDate || null,
        ministry_id: ministryId || null,
        requested_for: requestedFor.trim() || null,
        event_date: eventDate || null,
        deliverable_ids: deliverableIds,
      });

      const warnings = [...created.warnings];
      if (pendingFiles.length > 0) {
        try {
          const failures = await uploadAttachments(created.id, pendingFiles);
          if (failures.length > 0) {
            warnings.push(`These files could not be uploaded: ${failures.join("; ")}.`);
          }
        } catch (err) {
          console.error("Attachment upload failed:", err);
          warnings.push("The attached files could not be uploaded.");
        }
      }

      navigate(`/tickets/${created.id}`, {
        state: warnings.length > 0 ? { warning: warnings.join(" ") } : undefined,
      });
    } catch (err) {
      console.error("Ticket insert failed:", err);
      setError(messageOf(err, "Could not submit the ticket."));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 page-enter">
      <div className="relative overflow-hidden rounded-3xl border border-electric-500/20 bg-gradient-to-br from-electric-500/15 via-charcoal-950 to-charcoal-950 p-6 shadow-card sm:p-9"><span className="text-xs font-bold uppercase tracking-[.18em] text-electric-300">New support request</span><h1 className="mt-3 text-3xl font-semibold tracking-tight text-fog-100 sm:text-4xl">How can we help?</h1>
      <p className="mt-1 text-sm text-fog-500">
        Tell the media team what you need. The more detail you give, the faster we can help.
      </p></div>

      <form
        onSubmit={handleSubmit}
        className="space-y-7 rounded-3xl border border-charcoal-700 bg-charcoal-950 p-5 shadow-card sm:p-8"
      >
        <div>
          <label htmlFor="title" className={label}>
            Title
          </label>
          <input
            id="title"
            className={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder="Short summary of the request"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={label}>
              Category
            </label>
            <select
              id="category"
              className={field}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className={label}>
              Suggested priority
            </label>
            <select
              id="priority"
              className={field}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-fog-500">The media manager may adjust this.</p>
          </div>
        </div>

        {ministries.length > 0 && (
          <div>
            <label htmlFor="ministry" className={label}>
              Ministry (optional)
            </label>
            <select
              id="ministry"
              className={field}
              value={ministryId}
              onChange={(e) => setMinistryId(e.target.value)}
            >
              <option value="">Not applicable</option>
              {Object.entries(ministryGroups).map(([department, items]) => (
                <optgroup key={department} label={department}>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {deliverableTypes.length > 0 && (
          <fieldset>
            <legend className={label}>What do you need? (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {deliverableTypes.map((d) => {
                const checked = deliverableIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      checked
                        ? "border-blue-500 bg-blue-500/10 text-blue-200"
                        : "border-charcoal-700 bg-charcoal-900 text-fog-300 hover:border-charcoal-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleDeliverable(d.id)}
                    />
                    {d.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="requestedFor" className={label}>
            Requested on behalf of (optional)
          </label>
          <input
            id="requestedFor"
            className={field}
            value={requestedFor}
            onChange={(e) => setRequestedFor(e.target.value)}
            maxLength={150}
            placeholder="Name of the person or leader this is for"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="required" className={label}>
              Required by (optional)
            </label>
            <input
              id="required"
              type="date"
              min={today}
              className={field}
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="eventDate" className={label}>
              Event date (optional)
            </label>
            <input
              id="eventDate"
              type="date"
              className={field}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className={label}>
            Description
          </label>
          <textarea
            id="description"
            rows={6}
            className={field}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            required
            placeholder="What do you need, where, and when?"
          />
          <p className="mt-1 text-xs text-fog-500">
            At least {DESCRIPTION_MIN} characters. {description.trim().length}/{DESCRIPTION_MIN} so far.
          </p>
        </div>

        <div>
          <label htmlFor="files" className={label}>
            Attachments (optional)
          </label>
          <input
            id="files"
            type="file"
            multiple
            accept={FILE_ACCEPT}
            onChange={pickFiles}
            disabled={submitting || pendingFiles.length >= MAX_FILES}
            className="block w-full text-sm text-fog-500 file:mr-3 file:rounded-lg file:border-0 file:bg-charcoal-800 file:px-3 file:py-2 file:text-sm file:text-fog-300 hover:file:bg-zinc-700 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-fog-500">
            Up to {MAX_FILES} files, 10 MB each. You can add more after submitting.
          </p>
          {pendingFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {pendingFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-charcoal-900 px-3 py-1.5 text-sm"
                >
                  <span className="truncate text-fog-300">
                    {f.name} <span className="text-fog-500">· {formatBytes(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFiles((current) => current.filter((_, idx) => idx !== i));
                      setFileErrors([]);
                    }}
                    className="shrink-0 text-xs text-fog-500 hover:text-red-300"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileErrors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-300">
              {fileErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-charcoal-700 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-fog-500">Your request will be visible to the support team.</p><div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !categoryId}
            className="rounded-lg bg-electric-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit ticket"}
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}