import { supabase } from './supabase';
import type {
  Category,
  NewTicketInput,
  Priority,
  Status,
  Ticket,
  TicketScope,
} from '../types/ticket';

const PRIORITY_RANK: Record<Priority, number> = {
  Critical: 0,
  High: 1,
  Normal: 2,
  Low: 3,
};

// The database stores enum values in lowercase/underscore form;
// the UI uses display labels. These maps translate between the two.
export const PRIORITY_TO_DB: Record<Priority, string> = {
  Critical: 'critical',
  High: 'high',
  Normal: 'normal',
  Low: 'low',
};

export const STATUS_TO_DB: Record<Status, string> = {
  Submitted: 'submitted',
  'Under Review': 'under_review',
  Assigned: 'assigned',
  'In Progress': 'in_progress',
  'On Hold': 'on_hold',
  Completed: 'completed',
  Cancelled: 'cancelled',
};

function invert<L extends string>(map: Record<L, string>): Record<string, L> {
  return Object.fromEntries(
    Object.entries(map).map(([label, value]) => [value, label])
  ) as Record<string, L>;
}

const PRIORITY_FROM_DB = invert(PRIORITY_TO_DB);
const STATUS_FROM_DB = invert(STATUS_TO_DB);

type DbTicket = Omit<Ticket, 'priority' | 'status' | 'category'> & {
  priority: string;
  status: string;
  category: string | null;
  category_id: string;
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('You are not signed in. Please sign in again.');
  return id;
}

// Default queue order: priority, then earliest required date, then oldest submission.
export function sortQueue(a: Ticket, b: Ticket): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;

  const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export async function fetchTickets(scope: TicketScope): Promise<Ticket[]> {
  const userId = await currentUserId();

  let query = supabase.from('tickets').select('*');
  if (scope === 'mine') query = query.eq('requester_id', userId);
  if (scope === 'assigned') query = query.eq('assigned_to', userId);

  const { data, error } = await query;
  if (error) throw error;

  // Category names live in ticket_categories; tickets only store category_id.
  const { data: categoryRows } = await supabase
    .from('ticket_categories')
    .select('id, name');
  const categoryNames = new Map<string, string>(
    (categoryRows ?? []).map((c) => [c.id as string, c.name as string])
  );

  const tickets: Ticket[] = ((data ?? []) as DbTicket[]).map((row) => ({
    ...row,
    category: (categoryNames.get(row.category_id) ?? row.category ?? '') as Category,
    priority: PRIORITY_FROM_DB[row.priority] ?? (row.priority as Priority),
    status: STATUS_FROM_DB[row.status] ?? (row.status as Status),
  }));

  // Look up names separately so RLS on profiles never blocks the ticket list itself.
  const ids = Array.from(
    new Set(
      tickets
        .flatMap((t) => [t.requester_id, t.assigned_to])
        .filter((id): id is string => Boolean(id))
    )
  );

  const people = new Map<string, { full_name: string; department: string }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .in('id', ids);
    (profiles ?? []).forEach((p) => people.set(p.id, p));
  }

  return tickets
    .map((t) => ({
      ...t,
      requester_name: people.get(t.requester_id)?.full_name,
      requester_department: people.get(t.requester_id)?.department,
      assignee_name: t.assigned_to ? people.get(t.assigned_to)?.full_name : undefined,
    }))
    .sort(sortQueue);
}

export async function createTicket(
  input: NewTicketInput
): Promise<{ id: string; ticket_number: string }> {
  const userId = await currentUserId();

  // 1. Turn the category name into its id.
  const { data: category, error: categoryError } = await supabase
    .from('ticket_categories')
    .select('id')
    .eq('name', input.category)
    .eq('is_active', true)
    .maybeSingle();
  if (categoryError) throw categoryError;
  if (!category) {
    throw new Error(`The category "${input.category}" was not found. Please choose another one.`);
  }

  // 2. The ticket records the requester's department.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('department_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.department_id) {
    throw new Error(
      'Your account has no department assigned. Ask an administrator to set it, then try again.'
    );
  }

  // 3. Insert. status, submitted_at and ticket_number are filled in by the database.
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      title: input.title,
      description: input.description,
      category_id: category.id,
      requester_department_id: profile.department_id,
      requester_id: userId,
      priority: PRIORITY_TO_DB[input.priority],
      suggested_priority: PRIORITY_TO_DB[input.priority],
      due_date: input.due_date,
    })
    .select('id, ticket_number')
    .single();

  if (error) throw error;
  return data;
}