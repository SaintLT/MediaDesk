import {
  BarChart3, ClipboardCheck, LayoutDashboard, ListChecks, PlusCircle, Settings, Ticket, Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/db";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const ALL: Role[] = ["administrator", "media_manager", "media_member", "requester"];
const MANAGEMENT: Role[] = ["administrator", "media_manager"];

// Single source of truth for navigation AND route guards. This only controls what is SHOWN;
// the database (Row Level Security) is what actually protects the data.
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard, roles: ALL },
  { to: "/submit",         label: "Submit Ticket",  icon: PlusCircle,      roles: ALL },
  { to: "/tickets",        label: "All Tickets",    icon: ListChecks,      roles: MANAGEMENT },
  { to: "/my-tickets",     label: "My Tickets",     icon: Ticket,          roles: ALL },
  { to: "/my-assignments", label: "My Assignments", icon: ClipboardCheck,  roles: ["media_manager", "media_member"] },
  { to: "/team",           label: "Team",           icon: Users,           roles: MANAGEMENT },
  { to: "/reports",        label: "Reports",        icon: BarChart3,       roles: MANAGEMENT },
  { to: "/settings",       label: "Settings",       icon: Settings,        roles: ["administrator"] },
];

export const navFor = (role: Role) => NAV_ITEMS.filter((i) => i.roles.includes(role));
