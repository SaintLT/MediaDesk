import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, MoreHorizontal, Moon, Sun, X, ChevronRight, Sparkles } from "lucide-react";
import { useAuth, useProfile } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { navFor, type NavItem } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABELS } from "@/types/db";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-electric-500 text-base font-bold text-white shadow-glow" aria-hidden>M</span>
      <span className="text-lg font-bold tracking-tight text-fog-100">MediaDesk<span className="text-electric-400">.</span></span>
    </div>
  );
}

function ThemeButton({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-charcoal-700 bg-charcoal-900 text-fog-300 transition duration-200 hover:-translate-y-0.5 hover:border-electric-400/50 hover:text-fog-100",
        compact ? "h-10 w-10" : "h-10 px-3 text-sm font-medium",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-fog-700">Workspace</p>
      <ul className="space-y-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-electric-500 text-white shadow-[0_8px_24px_-12px_rgba(45,107,255,.8)]"
                    : "text-fog-500 hover:translate-x-0.5 hover:bg-charcoal-800 hover:text-fog-100",
                )
              }
            >
              <Icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110" aria-hidden />
              {label}
              <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-[.active]:opacity-70" aria-hidden />
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
    <div className="flex items-center gap-3 rounded-2xl border border-charcoal-700 bg-charcoal-900/80 p-3 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-electric-500/15 text-sm font-bold text-electric-300" aria-hidden>
        {initials(profile.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fog-100">{profile.full_name}</p>
        <p className="truncate text-xs text-fog-500">{ROLE_LABELS[profile.role]} · {profile.department?.name ?? "No department"}</p>
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label="Sign out"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fog-500 transition hover:bg-charcoal-700 hover:text-fog-100"
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
  const activeItem = items.find((item) => item.to === pathname);
  const pageTitle = activeItem?.label ?? (pathname.startsWith("/tickets/") ? "Ticket details" : "Workspace");

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
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-fog-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-electric-500 focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col gap-8 border-r border-charcoal-700/80 bg-charcoal-950/95 p-5 shadow-[12px_0_40px_-34px_rgba(0,0,0,.7)] backdrop-blur-xl md:flex">
        <div className="px-2 pt-1"><Brand /></div>
        <div className="flex-1 overflow-y-auto"><NavList items={items} /></div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-electric-500/20 bg-gradient-to-br from-electric-500/10 to-transparent p-4">
            <div className="mb-2 flex items-center gap-2 text-electric-300"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold">MediaDesk workspace</span></div>
            <p className="text-xs leading-5 text-fog-500">A clearer way to request, track and deliver support.</p>
          </div>
          <UserCard />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-charcoal-700/80 bg-charcoal-950/90 px-4 backdrop-blur-xl md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeButton compact />
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl text-fog-300 transition hover:bg-charcoal-800">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" tabIndex={-1} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] animate-rise flex-col gap-7 border-l border-charcoal-700 bg-charcoal-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button ref={closeRef} type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl text-fog-300 hover:bg-charcoal-800">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList items={items} onNavigate={() => setDrawerOpen(false)} /></div>
            <ThemeButton />
            <UserCard />
          </div>
        </div>
      )}

      <main id="main" className="md:pl-[272px]">
        <div className="mx-auto max-w-[1440px] px-4 pb-28 md:px-8 md:pb-10">
          <div className="hidden h-20 items-center justify-between border-b border-charcoal-700/60 md:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog-700">MediaDesk / Workspace</p>
              <h1 className="mt-1 text-sm font-semibold text-fog-100">{pageTitle}</h1>
            </div>
            <ThemeButton />
          </div>
          <div className="py-6 md:py-9 page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-30 border-t border-charcoal-700 bg-charcoal-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="flex">
          {bottomItems.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} className={({ isActive }) => cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition", isActive ? "text-electric-300" : "text-fog-500")}>
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
