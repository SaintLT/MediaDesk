import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth, RequireRole } from "@/components/guards";
import AppShell from "@/components/AppShell";
import { NAV_ITEMS } from "@/lib/nav";
import Login from "@/pages/Login";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";
import SubmitTicket from "@/pages/SubmitTicket";
import TicketList from "@/pages/TicketList";
import TicketDetail from "@/pages/TicketDetail";
import Dashboard from "@/pages/Dashboard";
import Team from "@/pages/Team";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

// Stage in which each screen is built. Replace the ComingSoon element with the real page as stages land.
const STAGE: Record<string, number> = {
  "/dashboard": 4, "/submit": 3, "/tickets": 3, "/my-tickets": 3,
  "/my-assignments": 3, "/team": 4, "/reports": 4, "/settings": 4,
};

// Screens that are built. Anything not listed here still shows ComingSoon.
const PAGES: Record<string, ReactNode> = {
  "/dashboard": <Dashboard />,
  "/submit": <SubmitTicket />,
  "/tickets": (
    <TicketList scope="all" title="All Tickets" subtitle="Every request across departments, in queue order." />
  ),
  "/my-tickets": (
    <TicketList scope="mine" title="My Tickets" subtitle="Requests you have submitted." />
  ),
  "/my-assignments": (
    <TicketList scope="assigned" title="My Assignments" subtitle="Tickets assigned to you." />
  ),
  "/team": <Team />,
  "/reports": <Reports />,
  "/settings": <Settings />,
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {NAV_ITEMS.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <RequireRole roles={item.roles}>
                    {PAGES[item.to] ?? <ComingSoon title={item.label} stage={STAGE[item.to] ?? 3} />}
                  </RequireRole>
                }
              />
            ))}
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}