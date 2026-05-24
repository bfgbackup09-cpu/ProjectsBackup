import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/project-context";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/production")({ component: Production });

function Production() {
  const { activeProject } = useProject();
  const qc = useQueryClient();
  const pid = activeProject?.id;
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const month = today.slice(0, 7);
  const { data: plan } = useQuery({
    queryKey: ["plan", pid, month], enabled: !!pid,
    queryFn: async () => (await supabase.from("monthly_plans").select("*").eq("project_id", pid!).eq("month", `${month}-01`).maybeSingle()).data,
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["prod", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("daily_production").select("*").eq("project_id", pid!).order("production_date", { ascending: false })).data ?? [],
  });

  const monthRows = rows.filter((r: any) => r.production_date.startsWith(month));
  const producedThisMonth = monthRows.reduce((s, r: any) => s + Number(r.produced_qty || 0), 0);
  const planned = plan?.planned_qty ?? 0;
  const balance = Math.max(0, planned - producedThisMonth);
  const today_d = new Date();
  const lastDay = new Date(today_d.getFullYear(), today_d.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, lastDay - today_d.getDate() + 1);
  const requiredRate = balance / remainingDays;
  const actualRate = monthRows.length ? producedThisMonth / monthRows.length : 0;
  const behind = actualRate < requiredRate && balance > 0;
  const pct = planned ? Math.round((producedThisMonth / planned) * 100) : 0;

  const save = async () => {
    if (!qty) { toast.error("Enter quantity"); return; }
    const { error } = await supabase.from("daily_production").upsert({
      project_id: pid!, production_date: date, produced_qty: Number(qty), notes: notes || null,
    }, { onConflict: "project_id,production_date" });
    if (error) toast.error(error.message); else { toast.success("Production logged"); setQty(""); setNotes(""); qc.invalidateQueries({ queryKey: ["prod", pid] }); }
  };

  if (!activeProject) return (<><PageHeader title="Daily Production" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select a project.</CardContent></Card></>);

  return (
    <>
      <PageHeader title="Daily Production" description="Log today's manufactured panels and follow up with the factory" />

      {behind && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          <AlertTriangle className="size-5 text-warning mt-0.5" />
          <div>
            <div className="font-medium">You're behind plan.</div>
            <div className="text-muted-foreground">Required rate to finish the month: <b>{requiredRate.toFixed(1)}</b> panels/day. Your current rate: <b>{actualRate.toFixed(1)}</b>. Push the factory to deliver more — call them today.</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Stat label="Planned this month" value={planned} />
        <Stat label="Produced so far" value={producedThisMonth} />
        <Stat label="Balance" value={balance} extra={<Progress value={pct} className="mt-2" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Log production</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Panels manufactured"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Factory follow-up notes" /></Field>
            <Button onClick={save}>Save</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent days</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.slice(0, 14).map((r: any) => (
                  <TableRow key={r.id}><TableCell>{r.production_date}</TableCell><TableCell className="text-right">{r.produced_qty}</TableCell><TableCell className="max-w-[200px] truncate">{r.notes}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, extra }: any) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold mt-1">{value}</div>{extra}</CardContent></Card>;
}
function Field({ label, children }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
