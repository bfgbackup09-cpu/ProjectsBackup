import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X } from "lucide-react";

type Reminder = { id: string; label: string; href: string; severity: "info" | "warn" };

function buildReminders(now: Date): Reminder[] {
  const items: Reminder[] = [];
  const day = now.getDay(); // 0 Sun ... 2 Tue
  const date = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  if (day === 2) items.push({ id: "tue-onepager", label: "Tuesday: update the One-Pager PPT for the week.", href: "/app/one-pager", severity: "warn" });
  items.push({ id: "daily-dash", label: "Daily: update Dashboard with today's status.", href: "/app/dashboard", severity: "info" });
  items.push({ id: "daily-prod", label: "Daily: log today's manufactured panels and follow up with factory.", href: "/app/production", severity: "info" });
  items.push({ id: "daily-delivery", label: "Daily: update Delivery Tracker.", href: "/app/delivery", severity: "info" });
  if (date >= lastDay - 1) items.push({ id: "month-cost", label: "Month-end: complete monthly Costing.", href: "/app/costing", severity: "warn" });
  return items;
}

export function ReminderBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const reminders = buildReminders(new Date()).filter((r) => !dismissed.has(r.id));

  useEffect(() => {
    if (!user) return;
    // Log shown reminders once per day per type
    const key = `reminders_logged_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    reminders.forEach((r) => {
      supabase.from("reminder_log").insert({
        reminder_type: r.id,
        triggered_for: new Date().toISOString().slice(0, 10),
        channel: "in_app",
        user_id: user.id,
      });
    });
  }, [user, reminders]);

  if (!reminders.length) return null;
  return (
    <div className="border-b bg-accent/40">
      {reminders.map((r) => (
        <div key={r.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${r.severity === "warn" ? "bg-warning/20" : ""}`}>
          <Bell className="size-4 shrink-0" />
          <span className="flex-1">{r.label}</span>
          <Link to={r.href} className="text-primary font-medium hover:underline">Open →</Link>
          <button onClick={() => setDismissed((s) => new Set(s).add(r.id))} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
