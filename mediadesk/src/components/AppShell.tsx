import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, MoreHorizontal, X } from "lucide-react";
import { useAuth, useProfile } from "@/contexts/AuthContext";
import { navFor, type NavItem } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/types/db";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric-500 text-sm font-bold text-white shadow-glow" aria-hidden>M</span>
      <span className="text-base font-semibold tracking-tight">MediaDesk</span>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-electric-500/10 text-fog-100 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-electric-400"
                    : "text-fog-500 hover:bg-charcoal-800 hover:text-fog-100",
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UserCard() {
  const profile = useProfile();
  const { signOut } = useAuth();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-charcoal-700 bg-charcoal-900 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-charcoal-600 text-xs font-semibold" aria-hidden>
        {initials(profile.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{profile.full_name}</p>
        <p className="truncate text-xs text-fog-500">{ROLE_LABELS[profile.role]} · {profile.department?.name ?? "No department"}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fog-500 transition-colors hover:bg-charcoal-700 hover:text-fog-100"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export default function AppShell() {
  const profile = useProfile();
  const items = navFor(profile.role);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const bottomItems = items.slice(0, 4);
  const needsMore = items.length > 4;

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-electric-500 focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop / tablet sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-charcoal-700 bg-charcoal-950 p-4 md:flex">
        <div className="px-2 pt-1"><Brand /></div>
        <div className="flex-1 overflow-y-auto"><NavList items={items} /></div>
        <UserCard />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-charcoal-700 bg-charcoal-950/95 px-4 backdrop-blur md:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid h-10 w-10 place-items-center rounded-lg text-fog-300 hover:bg-charcoal-800"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" tabIndex={-1} className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] animate-rise flex-col gap-6 bg-charcoal-950 p-4">
            <div className="flex items-center justify-between px-2 pt-1">
              <Brand />
              <button ref={closeRef} type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-lg text-fog-300 hover:bg-charcoal-800">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList items={items} onNavigate={() => setDrawerOpen(false)} /></div>
            <UserCard />
          </div>
        </div>
      )}

      <main id="main" className="md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-30 border-t border-charcoal-700 bg-charcoal-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="flex">
          {bottomItems.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive ? "text-electric-300" : "text-fog-500")
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="max-w-full truncate px-1">{label}</span>
              </NavLink>
            </li>
          ))}
          {needsMore && (
            <li className="flex-1">
              <button type="button" onClick={() => setDrawerOpen(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-fog-500">
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
