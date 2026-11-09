export type Role = "administrator" | "normal_user";
export type Priority = "critical" | "high" | "medium" | "low";
export type Status =
  | "submitted" | "under_review" | "assigned" | "in_progress" | "on_hold" | "completed" | "cancelled";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  normal_user: "Normal User",
};

// Highest first: matches the database enum order, so sorting by it gives Critical -> Low.
export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low",
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
