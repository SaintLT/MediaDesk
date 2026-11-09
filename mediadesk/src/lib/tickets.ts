import { supabase } from "./supabase";
import type {
  ActivityEntry,
  AttachmentEntry,
  Category,
  CommentEntry,
  CreatedTicket,
  DeliverableType,
  Ministry,
  NewTicketInput,
  TeamMember,
  Ticket,
  TicketScope,
  TicketUpdate,
} from "../types/ticket";
import type { Priority } from "../types/db";

// ---------- Attachment rules ----------
const BUCKET = "ticket-attachments";
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "pdf",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip",
];
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFiles(
  current: File[],
  incoming: File[]
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];

  for (const f of incoming) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(`${f.name}: this file type is not allowed.`);
    } else if (f.size === 0) {
      errors.push(`${f.name}: the file is empty.`);
    } else if (f.size > MAX_FILE_BYTES) {
      errors.push(`${f.name}: larger than 10 MB.`);
    } else if (current.length + accepted.length >= MAX_FILES) {
      errors.push(`${f.name}: only ${MAX_FILES} files can be added at a time.`);
    } else if ([...current, ...accepted].some((c) => c.name === f.name && c.size === f.size)) {
      errors.push(`${f.name}: already added.`);
    } else {
      accepted.push(f);
    }
  }
  return { accepted, errors };
}

// ---------- Helpers ----------
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TicketRow = Omit<
  Ticket,
  "category_name" | "ministry_name" | "requester_name" | "requester_department" | "assignee_name"
>;

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("You are not signed in. Please sign in again.");
  return id;
}

// Names are looked up separately so RLS on profiles never blocks the main query.
async function fetchNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  ((data ?? []) as { id: string; full_name: string }[]).forEach((p) =>
    names.set(p.id, p.full_name)
  );
  return names;
}

// Default queue order: priority, then earliest required date, then oldest submission.
export function sortQueue(a: Ticket, b: Ticket): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;

  const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  if (aDate !== bDate) return aDate < bDate ? -1 : 1;

  return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
}

async function enrichTickets(rows: TicketRow[]): Promise<Ticket[]> {
  if (rows.length === 0) return [];

  const personIds = Array.from(
    new Set(
      rows
        .flatMap((t) => [t.requester_id, t.assigned_to])
        .filter((id): id is string => Boolean(id))
    )
  );

  const [categoriesRes, ministriesRes, profilesRes, departmentsRes] = await Promise.all([
    supabase.from("ticket_categories").select("id, name"),
    supabase.from("ministries").select("id, name"),
    supabase.from("profiles").select("id, full_name, department_id").in("id", personIds),
    supabase.from("departments").select("id, name"),
  ]);

  const categoryNames = new Map(
    ((categoriesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
  );
  const ministryNames = new Map(
    ((ministriesRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );
  const departmentNames = new Map(
    ((departmentsRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );
  const people = new Map(
    (
      (profilesRes.data ?? []) as { id: string; full_name: string; department_id: string | null }[]
    ).map((p) => [p.id, p])
  );

  return rows.map((row) => {
    const requester = people.get(row.requester_id);
    const assignee = row.assigned_to ? people.get(row.assigned_to) : undefined;
    return {
      ...row,
      category_name: categoryNames.get(row.category_id) ?? "—",
      ministry_name: row.ministry_id ? ministryNames.get(row.ministry_id) ?? null : null,
      requester_name: requester?.full_name ?? null,
      requester_department: requester?.department_id
        ? departmentNames.get(requester.department_id) ?? null
        : null,
      assignee_name: assignee?.full_name ?? null,
    };
  });
}

// ---------- Lookups for the Submit Ticket form ----------
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("ticket_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchMinistries(): Promise<Ministry[]> {
  const [ministriesRes, departmentsRes] = await Promise.all([
    supabase
      .from("ministries")
      .select("id, department_id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("departments").select("id, name"),
  ]);
  if (ministriesRes.error) throw ministriesRes.error;

  const departmentNames = new Map(
    ((departmentsRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );
  return ((ministriesRes.data ?? []) as { id: string; department_id: string; name: string }[]).map(
    (m) => ({
      id: m.id,
      department_id: m.department_id,
      name: m.name,
      department_name: departmentNames.get(m.department_id) ?? null,
    })
  );
}

export async function fetchDeliverableTypes(): Promise<DeliverableType[]> {
  const { data, error } = await supabase
    .from("deliverable_types")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DeliverableType[];
}

// ---------- Tickets ----------
export async function fetchTickets(scope: TicketScope): Promise<Ticket[]> {
  const userId = await currentUserId();

  let query = supabase.from("tickets").select("*");
  if (scope === "mine") query = query.eq("requester_id", userId);
  if (scope === "assigned") query = query.eq("assigned_to", userId);

  const { data, error } = await query;
  if (error) throw error;

  const tickets = await enrichTickets((data ?? []) as TicketRow[]);
  return tickets.sort(sortQueue);
}

export async function fetchTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [ticket] = await enrichTickets([data as TicketRow]);
  return ticket ?? null;
}

export async function createTicket(input: NewTicketInput): Promise<CreatedTicket> {
  const userId = await currentUserId();

  // The ticket records the requester's department.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.department_id) {
    throw new Error(
      "Your account has no department assigned. Ask an administrator to set it, then try again."
    );
  }

  // status, submitted_at and ticket_number are filled in by the database.
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      title: input.title,
      description: input.description,
      category_id: input.category_id,
      requester_id: userId,
      requester_department_id: profile.department_id,
      priority: input.priority,
      suggested_priority: input.priority,
      due_date: input.due_date,
      ministry_id: input.ministry_id,
      requested_for: input.requested_for?.trim() || null,
      event_date: input.event_date,
    })
    .select("id, ticket_number")
    .single();
  if (error) throw error;

  const created = data as { id: string; ticket_number: string };
  const warnings: string[] = [];

  if (input.deliverable_ids.length > 0) {
    const { error: deliverableError } = await supabase.from("ticket_deliverables").insert(
      input.deliverable_ids.map((deliverable_type_id) => ({
        ticket_id: created.id,
        deliverable_type_id,
      }))
    );
    if (deliverableError) {
      console.error("Saving deliverables failed:", deliverableError);
      warnings.push("The deliverable types could not be saved.");
    }
  }

  return { id: created.id, ticket_number: created.ticket_number, warnings };
}

// The app only updates the tickets row; database triggers write the activity history.
export async function updateTicket(ticketId: string, patch: TicketUpdate): Promise<void> {
  const changes: Record<string, unknown> = {};
  if (patch.status !== undefined) changes.status = patch.status;
  if (patch.priority !== undefined) changes.priority = patch.priority;
  if (patch.assigned_to !== undefined) changes.assigned_to = patch.assigned_to;
  if (patch.resolution_note !== undefined) changes.resolution_note = patch.resolution_note;
  if (Object.keys(changes).length === 0) return;

  const { data, error } = await supabase
    .from("tickets")
    .update(changes)
    .eq("id", ticketId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("You do not have permission to change this ticket.");
  }
}

export async function fetchAssignableMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .eq("role", "administrator")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function fetchTicketDeliverables(ticketId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("ticket_deliverables")
    .select("deliverable_type_id")
    .eq("ticket_id", ticketId);
  if (error) throw error;

  const ids = ((data ?? []) as { deliverable_type_id: string }[]).map((r) => r.deliverable_type_id);
  if (ids.length === 0) return [];

  const { data: types, error: typesError } = await supabase
    .from("deliverable_types")
    .select("name, sort_order")
    .in("id", ids)
    .order("sort_order", { ascending: true });
  if (typesError) throw typesError;
  return ((types ?? []) as { name: string }[]).map((t) => t.name);
}

// ---------- Comments and activity ----------
export async function fetchComments(ticketId: string): Promise<CommentEntry[]> {
  const { data, error } = await supabase
    .from("ticket_comments")
    .select("id, body, created_at, author_id")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    body: string;
    created_at: string;
    author_id: string;
  }[];
  const names = await fetchNames(rows.map((r) => r.author_id));
  return rows.map((r) => ({
    id: String(r.id),
    body: r.body,
    created_at: r.created_at,
    author_id: r.author_id,
    author_name: names.get(r.author_id) ?? null,
  }));
}

export async function addComment(ticketId: string, body: string): Promise<void> {
  const userId = await currentUserId();
  const text = body.trim();
  if (!text) return;

  const { error } = await supabase
    .from("ticket_comments")
    .insert({ ticket_id: ticketId, author_id: userId, body: text });
  if (error) throw error;
}

export async function fetchActivity(ticketId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from("ticket_activity")
    .select("id, type, created_at, actor_id, old_value, new_value, note")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string | number;
    type: string;
    created_at: string;
    actor_id: string | null;
    old_value: string | null;
    new_value: string | null;
    note: string | null;
  }[];

  // Assignment entries may store user ids; show names instead.
  const isAssignment = (type: string) => type === "assigned" || type === "unassigned";
  const idsToResolve: string[] = [];
  rows.forEach((r) => {
    if (r.actor_id) idsToResolve.push(r.actor_id);
    if (isAssignment(r.type)) {
      if (r.old_value && UUID_PATTERN.test(r.old_value)) idsToResolve.push(r.old_value);
      if (r.new_value && UUID_PATTERN.test(r.new_value)) idsToResolve.push(r.new_value);
    }
  });
  const names = await fetchNames(idsToResolve);
  const display = (type: string, value: string | null): string | null =>
    value && isAssignment(type) && UUID_PATTERN.test(value) ? names.get(value) ?? value : value;

  return rows.map((r) => ({
    id: String(r.id),
    type: r.type,
    created_at: r.created_at,
    actor_id: r.actor_id,
    actor_name: r.actor_id ? names.get(r.actor_id) ?? null : null,
    old_value: display(r.type, r.old_value),
    new_value: display(r.type, r.new_value),
    note: r.note,
  }));
}

// ---------- Attachments ----------
export async function fetchAttachments(ticketId: string): Promise<AttachmentEntry[]> {
  const { data, error } = await supabase
    .from("ticket_attachments")
    .select("id, file_name, file_path, file_size, content_type, created_at, uploaded_by")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as Omit<AttachmentEntry, "uploader_name">[];
  const names = await fetchNames(rows.map((r) => r.uploaded_by));
  return rows.map((r) => ({ ...r, uploader_name: names.get(r.uploaded_by) ?? null }));
}

// Returns the names of any files that failed, so the caller can report them.
export async function uploadAttachments(ticketId: string, files: File[]): Promise<string[]> {
  const userId = await currentUserId();
  const failures: string[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${ticketId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) {
      failures.push(`${file.name} (${uploadError.message})`);
      continue;
    }

    const { error: rowError } = await supabase.from("ticket_attachments").insert({
      ticket_id: ticketId,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      content_type: file.type || null,
      uploaded_by: userId,
    });
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      failures.push(`${file.name} (${rowError.message})`);
    }
  }
  return failures;
}

export async function getAttachmentUrl(filePath: string, fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60, { download: fileName });
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not open this file.");
  }
  return data.signedUrl;
}

export async function deleteAttachment(attachment: AttachmentEntry): Promise<void> {
  const { data, error } = await supabase
    .from("ticket_attachments")
    .delete()
    .eq("id", attachment.id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("You do not have permission to remove this file.");
  }
  await supabase.storage.from(BUCKET).remove([attachment.file_path]);
}