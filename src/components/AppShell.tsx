import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useIsAdmin } from "@/lib/use-role";
import { LayoutDashboard, FileText, CalendarRange, Factory, Truck, Calculator, Bell, LogOut, Table2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReminderBanner } from "@/components/ReminderBanner";
import { ProjectProvider } from "@/lib/project-context";
import logo from "@/assets/logo.png";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/one-pager", label: "One-Pager", icon: FileText },
  { to: "/app/planning", label: "Planning", icon: CalendarRange },
  { to: "/app/production", label: "Daily Production", icon: Factory },
  { to: "/app/delivery", label: "Delivery Tracker", icon: Truck },
  { to: "/app/tracking", label: "Tracking Sheet", icon: Table2 },
  { to: "/app/costing", label: "Costing", icon: Calculator },
  { to: "/app/reminders", label: "Reminders", icon: Bell },
] as const;


export function AppShell() {
  const { user, loading, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const initials = useMemo(() => {
    const n = user?.user_metadata?.full_name || user?.email || "?";
    return String(n).slice(0, 2).toUpperCase();
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <ProjectProvider>
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border bg-white">
          <img src={logo} alt="BFG logo" className="h-10 w-auto" />
          <div>
            <div className="font-semibold text-foreground">BFG Projects Planner</div>
            <div className="text-xs text-muted-foreground">Project tracker</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
                }`}>
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link to="/app/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                location.pathname.startsWith("/app/admin") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
              }`}>
              <ShieldCheck className="size-4" /> Admin Panel
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user.user_metadata?.full_name || user.email}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => signOut()} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <ReminderBanner />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
        <div className="px-6 py-2 text-right text-[11px] text-muted-foreground border-t">By Ibrahim</div>
      </main>
    </div>
    </ProjectProvider>
  );
}
