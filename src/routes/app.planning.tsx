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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { exportSheets } from "@/lib/xlsx-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/planning")({ component: Planning });

function Planning() {
  const { activeProject } = useProject();
  const qc = useQueryClient();
  const pid = activeProject?.id;
  const [tab, setTab] = useState<"panels" | "monthly" | "daily">("panels");

  const { data: panels = [] } = useQuery({
    queryKey: ["panels", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("panels").select("*").eq("project_id", pid!).order("line_no")).data ?? [],
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["plans", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("monthly_plans").select("*").eq("project_id", pid!).order("month")).data ?? [],
  });
  const { data: dailyPlans = [] } = useQuery({
    queryKey: ["daily_plans", pid], enabled: !!pid,
    queryFn: async () => (await (supabase as any).from("daily_plans").select("*").eq("project_id", pid!).order("plan_date")).data ?? [],
  });
  const { data: production = [] } = useQuery({
    queryKey: ["prod", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("daily_production").select("*").eq("project_id", pid!).order("production_date")).data ?? [],
  });

  if (!activeProject) return (<><PageHeader title="Planning" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select or create a project first.</CardContent></Card></>);

  const downloadExcel = () => {
    const prodMap = new Map((production as any[]).map((r) => [r.production_date, Number(r.produced_qty)]));
    const dailyRows = (dailyPlans as any[]).map((d: any) => ({
      Date: d.plan_date, Planned: d.planned_qty, Actual: prodMap.get(d.plan_date) ?? 0,
      Diff: (prodMap.get(d.plan_date) ?? 0) - d.planned_qty,
    }));
    exportSheets(`planning-${activeProject.name}.xlsx`, [
      { name: "Panels catalogue", rows: (panels as any[]).map((p) => ({
        Scope: p.scope, "Sales order": p.sales_order, "Line no": p.line_no, "TRA code": p.tra_code,
        "Customer no": p.customer_no, Description: p.description, "Price (EUR)": p.price_eur,
        "Qty/TS": p.qty_per_ts, "PO Qty": p.po_quantity, Produced: p.total_produced,
        Balance: (p.po_quantity || 0) - (p.total_produced || 0),
      })) },
      { name: "Monthly plan", rows: (plans as any[]).map((p) => ({ Month: p.month, Planned: p.planned_qty })) },
      { name: "Daily plan vs Actual", rows: dailyRows },
    ]);
  };

  return (
    <>
      <PageHeader title="Planning" description="Define panels and plan demand" actions={
        <Button size="sm" variant="outline" onClick={downloadExcel}><Download className="size-4 mr-1" />Excel</Button>
      } />
      <div className="flex gap-2 mb-4">
        <Button variant={tab === "panels" ? "default" : "outline"} onClick={() => setTab("panels")}>Panels catalogue</Button>
        <Button variant={tab === "monthly" ? "default" : "outline"} onClick={() => setTab("monthly")}>Monthly plan</Button>
        <Button variant={tab === "daily" ? "default" : "outline"} onClick={() => setTab("daily")}>Daily plan vs Actual</Button>
      </div>

      {tab === "panels" && <PanelsTable panels={panels} pid={pid!} onChange={() => qc.invalidateQueries({ queryKey: ["panels", pid] })} />}
      {tab === "monthly" && <MonthlyPlan plans={plans} pid={pid!} onChange={() => qc.invalidateQueries({ queryKey: ["plans", pid] })} />}
      {tab === "daily" && <DailyPlan pid={pid!} />}
    </>
  );
}

function PanelsTable({ panels, pid, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ scope: "FRONT END", sales_order: "", line_no: "", tra_code: "", customer_no: "", description: "", price_eur: "", qty_per_ts: "2", po_quantity: "" });

  const add = async () => {
    if (!f.tra_code || !f.description) { toast.error("TRA code and description required"); return; }
    const { error } = await supabase.from("panels").insert({
      project_id: pid, scope: f.scope, sales_order: f.sales_order || null,
      line_no: f.line_no ? Number(f.line_no) : null, tra_code: f.tra_code, customer_no: f.customer_no || null,
      description: f.description, price_eur: f.price_eur ? Number(f.price_eur) : null,
      qty_per_ts: Number(f.qty_per_ts || 0), po_quantity: Number(f.po_quantity || 0),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Panel added"); onChange(); setOpen(false);
    setF({ scope: "FRONT END", sales_order: "", line_no: "", tra_code: "", customer_no: "", description: "", price_eur: "", qty_per_ts: "2", po_quantity: "" });
  };
  const updateProduced = async (id: string, val: number) => {
    const { error } = await supabase.from("panels").update({ total_produced: val }).eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this panel?")) return;
    await supabase.from("panels").delete().eq("id", id); onChange();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Panels ({panels.length})</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Add panel</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add panel</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <Field label="Scope"><Input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} /></Field>
              <Field label="Sales order"><Input value={f.sales_order} onChange={(e) => setF({ ...f, sales_order: e.target.value })} /></Field>
              <Field label="Line no."><Input type="number" value={f.line_no} onChange={(e) => setF({ ...f, line_no: e.target.value })} /></Field>
              <Field label="TRA code *"><Input value={f.tra_code} onChange={(e) => setF({ ...f, tra_code: e.target.value })} /></Field>
              <Field label="Customer no."><Input value={f.customer_no} onChange={(e) => setF({ ...f, customer_no: e.target.value })} /></Field>
              <Field label="Description *"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
              <Field label="Price (EUR)"><Input type="number" value={f.price_eur} onChange={(e) => setF({ ...f, price_eur: e.target.value })} /></Field>
              <Field label="Qty / Trainset"><Input type="number" value={f.qty_per_ts} onChange={(e) => setF({ ...f, qty_per_ts: e.target.value })} /></Field>
              <Field label="PO quantity"><Input type="number" value={f.po_quantity} onChange={(e) => setF({ ...f, po_quantity: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button onClick={add}>Add panel</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Scope</TableHead><TableHead>TRA</TableHead><TableHead>Description</TableHead><TableHead className="text-right">PO Qty</TableHead><TableHead className="text-right">Produced</TableHead><TableHead className="text-right">Balance</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {panels.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.scope}</TableCell>
                  <TableCell className="font-mono text-xs">{p.tra_code}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{p.description}</TableCell>
                  <TableCell className="text-right">{p.po_quantity}</TableCell>
                  <TableCell className="text-right"><Input type="number" defaultValue={p.total_produced} onBlur={(e) => updateProduced(p.id, Number(e.target.value))} className="w-20 h-8 text-right inline-block" /></TableCell>
                  <TableCell className="text-right">{(p.po_quantity || 0) - (p.total_produced || 0)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyPlan({ plans, pid, onChange }: any) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [qty, setQty] = useState("");
  const save = async () => {
    if (!qty) return;
    const { error } = await supabase.from("monthly_plans").upsert({
      project_id: pid, month: `${month}-01`, planned_qty: Number(qty),
    }, { onConflict: "project_id,month" });
    if (error) toast.error(error.message); else { toast.success("Plan saved"); setQty(""); onChange(); }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Monthly plan</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-3 items-end mb-4">
          <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          <Field label="Planned panels"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Button onClick={save}>Save plan</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Planned</TableHead></TableRow></TableHeader>
          <TableBody>
            {plans.map((p: any) => (<TableRow key={p.id}><TableCell>{p.month}</TableCell><TableCell className="text-right">{p.planned_qty}</TableCell></TableRow>))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function DailyPlan({ pid }: { pid: string }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState("");

  const { data: dailyPlans = [] } = useQuery({
    queryKey: ["daily_plans", pid],
    queryFn: async () => (await (supabase as any).from("daily_plans").select("*").eq("project_id", pid).order("plan_date")).data ?? [],
  });
  const { data: production = [] } = useQuery({
    queryKey: ["prod", pid],
    queryFn: async () => (await supabase.from("daily_production").select("*").eq("project_id", pid).order("production_date")).data ?? [],
  });

  const save = async () => {
    if (!qty) return;
    const { error } = await (supabase as any).from("daily_plans").upsert({
      project_id: pid, plan_date: date, planned_qty: Number(qty),
    }, { onConflict: "project_id,plan_date" });
    if (error) { toast.error(error.message); return; }
    toast.success("Daily plan saved"); setQty("");
    qc.invalidateQueries({ queryKey: ["daily_plans", pid] });
  };

  const remove = async (id: string) => {
    await (supabase as any).from("daily_plans").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["daily_plans", pid] });
  };

  const merged = useMemo(() => {
    const map = new Map<string, { date: string; Planned: number; Actual: number }>();
    for (const p of dailyPlans as any[]) map.set(p.plan_date, { date: p.plan_date, Planned: Number(p.planned_qty), Actual: 0 });
    for (const r of production as any[]) {
      const e = map.get(r.production_date) ?? { date: r.production_date, Planned: 0, Actual: 0 };
      e.Actual = Number(r.produced_qty);
      map.set(r.production_date, e);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyPlans, production]);

  const totalPlanned = merged.reduce((s, r) => s + r.Planned, 0);
  const totalActual = merged.reduce((s, r) => s + r.Actual, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Daily plan vs Actual production</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end mb-4">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Planned panels"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Button onClick={save}>Save daily plan</Button>
          </div>
          <div className="h-[320px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={merged}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Planned" fill="#3b82f6" />
                <Bar dataKey="Actual" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Planned</TableHead><TableHead className="text-right">Actual (from tracking)</TableHead><TableHead className="text-right">Diff</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {merged.map((r) => (
                <TableRow key={r.date}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell className="text-right">{r.Planned}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{r.Actual}</TableCell>
                  <TableCell className={`text-right ${r.Actual >= r.Planned ? "text-green-600" : "text-red-600"}`}>{r.Actual - r.Planned}</TableCell>
                  <TableCell className="text-right">
                    {(dailyPlans as any[]).find((p) => p.plan_date === r.date) && (
                      <Button size="icon" variant="ghost" onClick={() => remove((dailyPlans as any[]).find((p) => p.plan_date === r.date)!.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {merged.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data yet.</TableCell></TableRow>}
              {merged.length > 0 && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totalPlanned}</TableCell>
                  <TableCell className="text-right">{totalActual}</TableCell>
                  <TableCell className="text-right">{totalActual - totalPlanned}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
