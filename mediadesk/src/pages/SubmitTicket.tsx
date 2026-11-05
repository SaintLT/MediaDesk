import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicket } from '../lib/tickets';
import { CATEGORIES, PRIORITIES } from '../types/ticket';
import type { Category, Priority } from '../types/ticket';

const field =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

// These match the length rules enforced by the database.
const TITLE_MIN = 3;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 10000;

export default function SubmitTicket() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [priority, setPriority] = useState<Priority>('Normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (title.trim().length < TITLE_MIN) {
      setError(`Please enter a title of at least ${TITLE_MIN} characters.`);
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
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        due_date: requiredDate || null,
      });
      navigate('/my-tickets');
    } catch (err) {
      console.error('Ticket insert failed:', err);
      const message = (err as { message?: string } | null)?.message;
      setError(message || 'Could not submit the ticket.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">Submit a ticket</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Tell the media team what you need. The more detail you give, the faster we can help.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6"
      >
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-300">
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
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-zinc-300">
              Category
            </label>
            <select
              id="category"
              className={field}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="mb-1 block text-sm font-medium text-zinc-300">
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
                  {p}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">The media manager may adjust this.</p>
          </div>
        </div>

        <div>
          <label htmlFor="required" className="mb-1 block text-sm font-medium text-zinc-300">
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
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-300">
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
          <p className="mt-1 text-xs text-zinc-500">
            At least {DESCRIPTION_MIN} characters. {description.trim().length}/{DESCRIPTION_MIN} so far.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}