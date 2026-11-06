import type { Priority, Role, Status } from "@/types/db";

export type TicketScope = "all" | "mine" | "assigned";

export interface Category {
  id: string;
  name: string;
}

export interface DeliverableType {
  id: string;
  name: string;
}

export interface Ministry {
  id: string;
  department_id: string;
  name: string;
  department_name: string | null;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category_id: string;
  priority: Priority;
  suggested_priority: Priority;
  status: Status;
  due_date: string | null;
  ministry_id: string | null;
  requested_for: string | null;
  event_date: string | null;
  requester_id: string;
  requester_department_id: string;
  assigned_to: string | null;
  resolution_note: string | null;
  submitted_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  // Looked up separately for display.
  category_name: string;
  ministry_name: string | null;
  requester_name: string | null;
  requester_department: string | null;
  assignee_name: string | null;
}

export interface NewTicketInput {
  title: string;
  description: string;
  category_id: string;
  priority: Priority;
  due_date: string | null;
  ministry_id: string | null;
  requested_for: string | null;
  event_date: string | null;
  deliverable_ids: string[];
}

export interface CreatedTicket {
  id: string;
  ticket_number: string;
  warnings: string[];
}

export interface TicketUpdate {
  status?: Status;
  priority?: Priority;
  assigned_to?: string | null;
  resolution_note?: string | null;
}

export interface ActivityEntry {
  id: string;
  type: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
}

export interface CommentEntry {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string | null;
}

export interface AttachmentEntry {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string | null;
  created_at: string;
  uploaded_by: string;
  uploader_name: string | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: Role;
}