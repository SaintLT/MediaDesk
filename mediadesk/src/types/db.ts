export type Role = "administrator" | "media_manager" | "media_member" | "requester";
export type Priority = "critical" | "high" | "normal" | "low";
export type Status =
  | "submitted" | "under_review" | "assigned" | "in_progress" | "on_hold" | "completed" | "cancelled";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  media_manager: "Media Manager",
  media_member: "Media Team Member",
  requester: "Requester",
};

// Highest first: matches the database enum order, so sorting by it gives Critical -> Low.
export const PRIORITIES: Priority[] = ["critical", "high", "normal", "low"];
export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical", high: "High", normal: "Normal", low: "Low",
};

export const STATUSES: Status[] = [
  "submitted", "under_review", "assigned", "in_progress", "on_hold", "completed", "cancelled",
];
export const STATUS_LABELS: Record<Status, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department_id: string;
  role: Role;
  is_active: boolean;
  department: { name: string } | null;
}
