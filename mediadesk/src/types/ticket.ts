export const CATEGORIES = [
  'Equipment and technical issues',
  'Photography and videography',
  'Video and audio editing',
  'Graphic design',
  'Live streaming and event support',
  'General media requests',
] as const;

export const PRIORITIES = ['Critical', 'High', 'Normal', 'Low'] as const;

export const STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type TicketScope = 'all' | 'mine' | 'assigned';

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  due_date: string | null;
  requester_id: string;
  assigned_to: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  requester_department?: string;
  assignee_name?: string;
}

export interface NewTicketInput {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  due_date: string | null;
}
