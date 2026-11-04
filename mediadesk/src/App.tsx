import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth, RequireRole } from "@/components/guards";
import AppShell from "@/components/AppShell";
import { NAV_ITEMS } from "@/lib/nav";
import Login from "@/pages/Login";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";

// Stage in which each screen is built. Replace the ComingSoon element with the real page as stages land.
const STAGE: Record<string, number> = {
  "/dashboard": 4, "/submit": 3, "/tickets": 3, "/my-tickets": 3,
  "/my-assignments": 3, "/team": 4, "/reports": 4, "/settings": 4,
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            {NAV_ITEMS.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <RequireRole roles={item.roles}>
                    <ComingSoon title={item.label} stage={STAGE[item.to] ?? 3} />
                  </RequireRole>
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
