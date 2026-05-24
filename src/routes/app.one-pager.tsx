import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/project-context";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Download, Trash2, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/app/one-pager")({ component: OnePager });

function startOfWeek(d: Date) {
  const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1) - day; x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const PIE_COLORS = ["#10b981", "#f59e0b"]; // Invoiced (emerald), Remaining (amber)
const BAR_COLORS = { planned: "#3b82f6", actual: "#22c55e", otd: "#f97316", outstanding: "#ef4444" };

function OnePager() {
  const { activeProject } = useProject();
  const { user } = useAuth();
  const qc = useQueryClient();
  const pid = activeProject?.id;
  const [topic, setTopic] = useState("FRONT END");
  const [weekOf, setWeekOf] = useState(startOfWeek(new Date()));
  const [f, setF] = useState({ challenges: "", ongoing_progress: "", action_plan: "", outstanding_balance_eur: "", quality_notes: "" });

  // Financials state
  const [finMonth, setFinMonth] = useState(startOfMonth(new Date()));
  const [finPo, setFinPo] = useState("");
  const [finInv, setFinInv] = useState("");
  const [finNotes, setFinNotes] = useState("");

  // ECR state
  const [ecr, setEcr] = useState({ cr_no: "", date_initiation: "", released_to_bids: "", offer_sent_alstom: "", po_received_date: "", cr_status: "", roa_remarks: "" });
  const [editingEcrId, setEditingEcrId] = useState<string | null>(null);
  const [editEcr, setEditEcr] = useState<any>({});

  // Manufacturing state
  const [mm, setMm] = useState({ month: startOfMonth(new Date()), planned_qty: "", actual_qty: "", otd_percent: "", notes: "" });

  // Outstanding weekly state
  const [year, setYear] = useState(new Date().getFullYear());
  const [ob, setOb] = useState({ week_of: startOfWeek(new Date()), amount_eur: "", notes: "" });

  const { data: updates = [] } = useQuery({
    queryKey: ["onepager", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("one_pager_updates").select("*").eq("project_id", pid!).order("week_of", { ascending: false })).data ?? [],
  });

  const { data: panels = [] } = useQuery({
    queryKey: ["panels", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("panels").select("*").eq("project_id", pid!)).data ?? [],
  });

  const { data: financials = [] } = useQuery({
    queryKey: ["onepager-fin", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("one_pager_financials").select("*").eq("project_id", pid!).order("month", { ascending: false })).data ?? [],
  });

  const { data: ecrRows = [] } = useQuery({
    queryKey: ["ecr", pid], enabled: !!pid,
    queryFn: async () => (await (supabase as any).from("ecr_status").select("*").eq("project_id", pid!).order("date_initiation", { ascending: false })).data ?? [],
  });

  const { data: mmRows = [] } = useQuery({
    queryKey: ["mm", pid], enabled: !!pid,
    queryFn: async () => (await (supabase as any).from("monthly_manufacturing").select("*").eq("project_id", pid!).order("month", { ascending: true })).data ?? [],
  });

  const { data: obRows = [] } = useQuery({
    queryKey: ["ob", pid], enabled: !!pid,
    queryFn: async () => (await (supabase as any).from("outstanding_balance_weekly").select("*").eq("project_id", pid!).order("week_of", { ascending: true })).data ?? [],
  });

  const selectedFin = useMemo(
    () => financials.find((r: any) => r.month === finMonth) ?? null,
    [financials, finMonth]
  );

  const panelTotals = useMemo(() => {
    const po = (panels as any[]).reduce((s, p) => s + Number(p.price_eur || 0) * Number(p.po_quantity || 0), 0);
    const inv = (panels as any[]).reduce((s, p) => s + Number(p.price_eur || 0) * Number(p.total_produced || 0), 0);
    const panelsTotal = (panels as any[]).reduce((s, p) => s + Number(p.po_quantity || 0), 0);
    const panelsMade = (panels as any[]).reduce((s, p) => s + Number(p.total_produced || 0), 0);
    return { po, inv, remaining: Math.max(po - inv, 0), panelsTotal, panelsMade, panelsRemaining: Math.max(panelsTotal - panelsMade, 0) };
  }, [panels]);

  const chartData = useMemo(() => [
    { name: "Invoiced", value: panelTotals.inv },
    { name: "Remaining", value: panelTotals.remaining },
  ], [panelTotals]);

  const totalPO = panelTotals.po;

  // Manufacturing chart data — show all months in db (sorted ASC already)
  const mmChart = useMemo(() => mmRows.map((r: any) => ({
    month: String(r.month).slice(0, 7),
    Planned: Number(r.planned_qty ?? 0),
    Actual: Number(r.actual_qty ?? 0),
    "OTD %": Number(r.otd_percent ?? 0),
  })), [mmRows]);

  // Outstanding chart — filter by selected year
  const obChart = useMemo(() => obRows
    .filter((r: any) => new Date(r.week_of).getFullYear() === year)
    .map((r: any) => ({ week: String(r.week_of), Outstanding: Number(r.amount_eur ?? 0) })), [obRows, year]);

  const obYearTotal = useMemo(() => obChart.reduce((a: number, b: { Outstanding: number }) => a + b.Outstanding, 0), [obChart]);

  const save = async () => {
    const { error } = await supabase.from("one_pager_updates").insert({
      project_id: pid!, topic, week_of: weekOf,
      challenges: f.challenges || null, ongoing_progress: f.ongoing_progress || null, action_plan: f.action_plan || null,
      outstanding_balance_eur: f.outstanding_balance_eur ? Number(f.outstanding_balance_eur) : null,
      quality_notes: f.quality_notes || null, created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("One-pager update saved");
    setF({ challenges: "", ongoing_progress: "", action_plan: "", outstanding_balance_eur: "", quality_notes: "" });
    qc.invalidateQueries({ queryKey: ["onepager", pid] });
  };

  const saveFinancials = async () => {
    if (!pid) return;
    const po = Number(finPo || 0);
    const inv = Number(finInv || 0);
    if (inv > po) { toast.error("Invoiced cannot exceed Total PO"); return; }
    const { error } = await supabase.from("one_pager_financials").upsert({
      project_id: pid, month: finMonth,
      total_po_value_eur: po, invoiced_value_eur: inv,
      notes: finNotes || null, created_by: user?.id ?? null,
    }, { onConflict: "project_id,month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Monthly financials saved");
    setFinPo(""); setFinInv(""); setFinNotes("");
    qc.invalidateQueries({ queryKey: ["onepager-fin", pid] });
  };

  const saveEcr = async () => {
    if (!pid || !ecr.cr_no) { toast.error("CR No. is required"); return; }
    const { error } = await (supabase as any).from("ecr_status").insert({
      project_id: pid, cr_no: ecr.cr_no,
      date_initiation: ecr.date_initiation || null,
      released_to_bids: ecr.released_to_bids || null,
      offer_sent_alstom: ecr.offer_sent_alstom || null,
      po_received_date: ecr.po_received_date || null,
      cr_status: ecr.cr_status || null,
      roa_remarks: ecr.roa_remarks || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("ECR row added");
    setEcr({ cr_no: "", date_initiation: "", released_to_bids: "", offer_sent_alstom: "", po_received_date: "", cr_status: "", roa_remarks: "" });
    qc.invalidateQueries({ queryKey: ["ecr", pid] });
  };

  const deleteEcr = async (id: string) => {
    const { error } = await (supabase as any).from("ecr_status").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ecr", pid] });
  };

  const startEditEcr = (r: any) => {
    setEditingEcrId(r.id);
    setEditEcr({
      cr_no: r.cr_no ?? "",
      date_initiation: r.date_initiation ?? "",
      released_to_bids: r.released_to_bids ?? "",
      offer_sent_alstom: r.offer_sent_alstom ?? "",
      po_received_date: r.po_received_date ?? "",
      cr_status: r.cr_status ?? "",
      roa_remarks: r.roa_remarks ?? "",
    });
  };

  const saveEditEcr = async () => {
    if (!editingEcrId) return;
    if (!editEcr.cr_no) { toast.error("CR No. is required"); return; }
    const { error } = await (supabase as any).from("ecr_status").update({
      cr_no: editEcr.cr_no,
      date_initiation: editEcr.date_initiation || null,
      released_to_bids: editEcr.released_to_bids || null,
      offer_sent_alstom: editEcr.offer_sent_alstom || null,
      po_received_date: editEcr.po_received_date || null,
      cr_status: editEcr.cr_status || null,
      roa_remarks: editEcr.roa_remarks || null,
    }).eq("id", editingEcrId);
    if (error) { toast.error(error.message); return; }
    toast.success("ECR row updated");
    setEditingEcrId(null);
    setEditEcr({});
    qc.invalidateQueries({ queryKey: ["ecr", pid] });
  };


  const saveMm = async () => {
    if (!pid) return;
    const planned = Number(mm.planned_qty || 0);
    const actual = Number(mm.actual_qty || 0);
    const otd = mm.otd_percent ? Number(mm.otd_percent) : (planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0);
    const { error } = await (supabase as any).from("monthly_manufacturing").upsert({
      project_id: pid, month: mm.month,
      planned_qty: planned, actual_qty: actual, otd_percent: otd, notes: mm.notes || null,
      created_by: user?.id ?? null,
    }, { onConflict: "project_id,month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Manufacturing record saved");
    setMm({ month: startOfMonth(new Date()), planned_qty: "", actual_qty: "", otd_percent: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["mm", pid] });
  };

  const deleteMm = async (id: string) => {
    const { error } = await (supabase as any).from("monthly_manufacturing").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["mm", pid] });
  };

  const saveOb = async () => {
    if (!pid) return;
    const { error } = await (supabase as any).from("outstanding_balance_weekly").upsert({
      project_id: pid, week_of: ob.week_of,
      amount_eur: Number(ob.amount_eur || 0), notes: ob.notes || null,
      created_by: user?.id ?? null,
    }, { onConflict: "project_id,week_of" });
    if (error) { toast.error(error.message); return; }
    toast.success("Outstanding balance saved");
    setOb({ week_of: startOfWeek(new Date()), amount_eur: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["ob", pid] });
  };

  const deleteOb = async (id: string) => {
    const { error } = await (supabase as any).from("outstanding_balance_weekly").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ob", pid] });
  };

  const downloadPpt = async () => {
    if (!activeProject) return;
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const latest = updates[0] as any;
    const fin = selectedFin as any;
    const fmtN = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const s = pptx.addSlide();
    s.background = { color: "F8FAFC" };
    s.addText(`${activeProject.name} — One Pager`, { x: 0.4, y: 0.3, w: 12.5, h: 0.6, fontSize: 28, bold: true, color: "1E2761" });
    s.addText(
      `Customer: ${activeProject.customer ?? "-"}   |   OEM: ${activeProject.oem ?? "-"}   |   Site: ${activeProject.site ?? "-"}   |   Trainsets: ${activeProject.trainsets ?? "-"}`,
      { x: 0.4, y: 0.95, w: 12.5, h: 0.35, fontSize: 12, color: "475569" }
    );

    s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 1.45, w: 7.8, h: 5.6, fill: { color: "FFFFFF" }, line: { color: "E2E8F0" } });
    s.addText(`Weekly Update — ${latest?.topic ?? "-"} (Week of ${latest?.week_of ?? "-"})`, { x: 0.6, y: 1.55, w: 7.4, h: 0.4, fontSize: 16, bold: true, color: "1E2761" });
    const rows: [string, string][] = [
      ["Challenges", latest?.challenges ?? "-"],
      ["Ongoing Progress", latest?.ongoing_progress ?? "-"],
      ["Action Plan", latest?.action_plan ?? "-"],
      ["Outstanding Balance (EUR)", latest?.outstanding_balance_eur ? fmtN(Number(latest.outstanding_balance_eur)) : "-"],
      ["Quality Notes", latest?.quality_notes ?? "-"],
    ];
    let y = 2.05;
    rows.forEach(([k, v]) => {
      s.addText(k, { x: 0.6, y, w: 2.2, h: 0.9, fontSize: 11, bold: true, color: "475569", valign: "top" });
      s.addText(String(v), { x: 2.85, y, w: 5.25, h: 0.9, fontSize: 11, color: "0F172A", valign: "top" });
      y += 1.0;
    });

    const po = panelTotals.po;
    const inv = panelTotals.inv;
    const rem = panelTotals.remaining;
    s.addShape(pptx.ShapeType.rect, { x: 8.4, y: 1.45, w: 4.5, h: 5.6, fill: { color: "FFFFFF" }, line: { color: "E2E8F0" } });
    s.addText(`Financials — Auto from Panels`, { x: 8.6, y: 1.55, w: 4.1, h: 0.4, fontSize: 16, bold: true, color: "1E2761" });
    s.addChart(pptx.ChartType.doughnut, [
      { name: "PO Breakdown", labels: ["Invoiced", "Remaining"], values: [inv, rem || (po === 0 ? 1 : 0)] },
    ], { x: 8.6, y: 2.0, w: 4.1, h: 3.0, chartColors: ["10B981", "F59E0B"], showLegend: true, legendPos: "b" });
    s.addText(`Total PO: ${fmtN(po)} EUR`, { x: 8.6, y: 5.1, w: 4.1, h: 0.35, fontSize: 12, bold: true });
    s.addText(`Invoiced: ${fmtN(inv)} EUR`, { x: 8.6, y: 5.45, w: 4.1, h: 0.35, fontSize: 12 });
    s.addText(`Balance: ${fmtN(rem)} EUR`, { x: 8.6, y: 5.8, w: 4.1, h: 0.35, fontSize: 12 });

    // Slide 2: Manufacturing + Outstanding
    if (mmChart.length || obChart.length) {
      const s2 = pptx.addSlide();
      s2.background = { color: "F8FAFC" };
      s2.addText("Manufacturing & Outstanding", { x: 0.4, y: 0.3, w: 12.5, h: 0.5, fontSize: 22, bold: true, color: "1E2761" });
      if (mmChart.length) {
        s2.addText("Planned vs Actual & OTD%", { x: 0.4, y: 0.9, w: 6, h: 0.3, fontSize: 12, bold: true });
        s2.addChart(pptx.ChartType.bar, [
          { name: "Planned", labels: mmChart.map((r: any) => r.month), values: mmChart.map((r: any) => r.Planned) },
          { name: "Actual", labels: mmChart.map((r: any) => r.month), values: mmChart.map((r: any) => r.Actual) },
          { name: "OTD %", labels: mmChart.map((r: any) => r.month), values: mmChart.map((r: any) => r["OTD %"]) },
        ], { x: 0.4, y: 1.2, w: 6.2, h: 5.5, barDir: "col", barGrouping: "clustered", chartColors: ["3B82F6", "22C55E", "F97316"], showLegend: true, legendPos: "b" });
      }
      if (obChart.length) {
        s2.addText(`Outstanding Balance ${year}`, { x: 6.8, y: 0.9, w: 6, h: 0.3, fontSize: 12, bold: true });
        s2.addChart(pptx.ChartType.bar, [
          { name: "Outstanding (EUR)", labels: obChart.map((r: any) => r.week), values: obChart.map((r: any) => r.Outstanding) },
        ], { x: 6.8, y: 1.2, w: 6.2, h: 5.5, barDir: "col", barGrouping: "clustered", chartColors: ["EF4444"], showLegend: true, legendPos: "b" });
      }
    }

    await pptx.writeFile({ fileName: `${activeProject.name.replace(/\s+/g, "_")}_OnePager_${new Date().toISOString().slice(0,10)}.pptx` });
    toast.success("One-pager PPT downloaded");
  };

  if (!activeProject) return (<><PageHeader title="One-Pager" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select a project.</CardContent></Card></>);

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <>
      <PageHeader
        title="One-Pager Update"
        description="Weekly update — every Tuesday. Captures challenges, action plan, outstanding balance & quality."
        actions={<Button variant="outline" onClick={downloadPpt}><Download className="size-4 mr-2" />Download PPT</Button>}
      />

      {/* Financial Pie Chart Section — auto-calculated from Panels (price × quantity) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>PO Value Breakdown — Auto-calculated from Panels</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Invoiced = Σ(price × produced). Remaining = Σ(price × (PO qty − produced)). Update panel prices & produced qty in Planning / Tracking.</p>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total PO" value={fmt(panelTotals.po)} />
                <Stat label="Invoiced" value={fmt(panelTotals.inv)} />
                <Stat label="Balance" value={fmt(panelTotals.remaining)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Panels PO qty</div><div className="font-semibold">{panelTotals.panelsTotal}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Panels made</div><div className="font-semibold">{panelTotals.panelsMade}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Panels remaining</div><div className="font-semibold">{panelTotals.panelsRemaining}</div></div>
              </div>
              <details className="pt-3 border-t">
                <summary className="text-xs text-muted-foreground cursor-pointer">Optional: log a manual monthly snapshot</summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Month"><Input type="month" value={finMonth.slice(0, 7)} onChange={(e) => setFinMonth(e.target.value + "-01")} /></Field>
                  <Field label="Total PO Value (EUR)">
                    <Input type="number" placeholder={String(panelTotals.po)} value={finPo} onChange={(e) => setFinPo(e.target.value)} />
                  </Field>
                  <Field label="Invoiced Value (EUR)">
                    <Input type="number" placeholder={String(panelTotals.inv)} value={finInv} onChange={(e) => setFinInv(e.target.value)} />
                  </Field>
                  <Field label="Notes"><Input value={finNotes} onChange={(e) => setFinNotes(e.target.value)} placeholder={selectedFin?.notes ?? ""} /></Field>
                </div>
                <Button className="mt-2" size="sm" onClick={saveFinancials}>Save snapshot</Button>
              </details>
            </div>
            <div className="h-[280px]">
              {totalPO > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${fmt(e.value)}`}>
                      {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(Number(v)) + " EUR"} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Add panels with price & PO quantity in Planning to see the chart.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ECR Status */}
      <Card className="mb-6">
        <CardHeader><CardTitle>ECR Status</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="CR No."><Input value={ecr.cr_no} onChange={(e) => setEcr({ ...ecr, cr_no: e.target.value })} /></Field>
            <Field label="Date of Initiation"><Input type="date" value={ecr.date_initiation} onChange={(e) => setEcr({ ...ecr, date_initiation: e.target.value })} /></Field>
            <Field label="Released to BIDs"><Input type="date" value={ecr.released_to_bids} onChange={(e) => setEcr({ ...ecr, released_to_bids: e.target.value })} /></Field>
            <Field label="Offer Sent to Alstom"><Input type="date" value={ecr.offer_sent_alstom} onChange={(e) => setEcr({ ...ecr, offer_sent_alstom: e.target.value })} /></Field>
            <Field label="PO Received Date"><Input type="date" value={ecr.po_received_date} onChange={(e) => setEcr({ ...ecr, po_received_date: e.target.value })} /></Field>
            <Field label="CR Status"><Input value={ecr.cr_status} onChange={(e) => setEcr({ ...ecr, cr_status: e.target.value })} placeholder="Open / Closed / In Progress" /></Field>
            <Field label="ROA Remarks"><Input value={ecr.roa_remarks} onChange={(e) => setEcr({ ...ecr, roa_remarks: e.target.value })} /></Field>
            <div className="flex items-end"><Button onClick={saveEcr} className="w-full">Add ECR row</Button></div>
          </div>
          <div className="overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CR No.</TableHead>
                  <TableHead>Initiation</TableHead>
                  <TableHead>Released to BIDs</TableHead>
                  <TableHead>Offer to Alstom</TableHead>
                  <TableHead>PO Received</TableHead>
                  <TableHead>CR Status</TableHead>
                  <TableHead>ROA Remarks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecrRows.map((r: any) => {
                  const isEditing = editingEcrId === r.id;
                  if (!isEditing) {
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.cr_no}</TableCell>
                        <TableCell>{r.date_initiation ?? "-"}</TableCell>
                        <TableCell>{r.released_to_bids ?? "-"}</TableCell>
                        <TableCell>{r.offer_sent_alstom ?? "-"}</TableCell>
                        <TableCell>{r.po_received_date ?? "-"}</TableCell>
                        <TableCell>{r.cr_status ?? "-"}</TableCell>
                        <TableCell>{r.roa_remarks ?? "-"}</TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEditEcr(r)}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteEcr(r.id)}><Trash2 className="size-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={r.id}>
                      <TableCell><Input value={editEcr.cr_no} onChange={(e) => setEditEcr({ ...editEcr, cr_no: e.target.value })} /></TableCell>
                      <TableCell><Input type="date" value={editEcr.date_initiation} onChange={(e) => setEditEcr({ ...editEcr, date_initiation: e.target.value })} /></TableCell>
                      <TableCell><Input type="date" value={editEcr.released_to_bids} onChange={(e) => setEditEcr({ ...editEcr, released_to_bids: e.target.value })} /></TableCell>
                      <TableCell><Input type="date" value={editEcr.offer_sent_alstom} onChange={(e) => setEditEcr({ ...editEcr, offer_sent_alstom: e.target.value })} /></TableCell>
                      <TableCell><Input type="date" value={editEcr.po_received_date} onChange={(e) => setEditEcr({ ...editEcr, po_received_date: e.target.value })} /></TableCell>
                      <TableCell><Input value={editEcr.cr_status} onChange={(e) => setEditEcr({ ...editEcr, cr_status: e.target.value })} /></TableCell>
                      <TableCell><Input value={editEcr.roa_remarks} onChange={(e) => setEditEcr({ ...editEcr, roa_remarks: e.target.value })} /></TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={saveEditEcr}><Check className="size-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingEcrId(null); setEditEcr({}); }}><X className="size-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {ecrRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No ECR rows yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manufacturing Planned vs Actual + OTD% */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Manufacturing — Planned vs Actual & OTD%</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-6 gap-3">
            <Field label="Month"><Input type="month" value={mm.month.slice(0,7)} onChange={(e) => setMm({ ...mm, month: e.target.value + "-01" })} /></Field>
            <Field label="Planned Panels"><Input type="number" value={mm.planned_qty} onChange={(e) => setMm({ ...mm, planned_qty: e.target.value })} /></Field>
            <Field label="Actual Manufactured"><Input type="number" value={mm.actual_qty} onChange={(e) => setMm({ ...mm, actual_qty: e.target.value })} /></Field>
            <Field label="OTD % (auto if blank)"><Input type="number" step="0.1" value={mm.otd_percent} onChange={(e) => setMm({ ...mm, otd_percent: e.target.value })} /></Field>
            <Field label="Notes"><Input value={mm.notes} onChange={(e) => setMm({ ...mm, notes: e.target.value })} /></Field>
            <div className="flex items-end"><Button onClick={saveMm} className="w-full">Save month</Button></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="overflow-auto border rounded-md">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Month</TableHead><TableHead>Planned</TableHead><TableHead>Actual</TableHead><TableHead>OTD %</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {[...mmRows].reverse().map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{String(r.month).slice(0,7)}</TableCell>
                      <TableCell>{r.planned_qty}</TableCell>
                      <TableCell>{r.actual_qty}</TableCell>
                      <TableCell>{r.otd_percent ?? "-"}%</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => deleteMm(r.id)}><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {mmRows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No monthly data yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="h-[320px]">
              {mmChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mmChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Planned" fill={BAR_COLORS.planned} radius={[4,4,0,0]} />
                    <Bar dataKey="Actual" fill={BAR_COLORS.actual} radius={[4,4,0,0]} />
                    <Bar dataKey="OTD %" fill={BAR_COLORS.otd} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Add monthly data to see the chart.</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Balance Weekly */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Outstanding Balance — Weekly</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Input type="number" className="w-24 h-8" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              <span className="text-muted-foreground">Total {year}: <b className="text-foreground">{fmt(obYearTotal)} EUR</b></span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Week of"><Input type="date" value={ob.week_of} onChange={(e) => setOb({ ...ob, week_of: e.target.value })} /></Field>
            <Field label="Outstanding (EUR)"><Input type="number" value={ob.amount_eur} onChange={(e) => setOb({ ...ob, amount_eur: e.target.value })} /></Field>
            <Field label="Notes"><Input value={ob.notes} onChange={(e) => setOb({ ...ob, notes: e.target.value })} /></Field>
            <div className="flex items-end"><Button onClick={saveOb} className="w-full">Save week</Button></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="overflow-auto border rounded-md max-h-[320px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Week of</TableHead><TableHead>Amount (EUR)</TableHead><TableHead>Notes</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {obRows.filter((r: any) => new Date(r.week_of).getFullYear() === year).reverse().map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.week_of}</TableCell>
                      <TableCell>{fmt(Number(r.amount_eur))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.notes ?? ""}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => deleteOb(r.id)}><Trash2 className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {obChart.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No outstanding records for {year}.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="h-[320px]">
              {obChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={obChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt(Number(v)) + " EUR"} />
                    <Legend />
                    <Bar dataKey="Outstanding" fill={BAR_COLORS.outstanding} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for {year}.</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>New weekly update</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Topic">
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="FRONT END">FRONT END</option>
                  <option value="CAB LINING">CAB LINING</option>
                  <option value="Quality">Quality</option>
                </select>
              </Field>
              <Field label="Week of"><Input type="date" value={weekOf} onChange={(e) => setWeekOf(e.target.value)} /></Field>
            </div>
            <Field label="Challenges"><Textarea rows={2} value={f.challenges} onChange={(e) => setF({ ...f, challenges: e.target.value })} /></Field>
            <Field label="Ongoing progress"><Textarea rows={2} value={f.ongoing_progress} onChange={(e) => setF({ ...f, ongoing_progress: e.target.value })} /></Field>
            <Field label="Action plan"><Textarea rows={2} value={f.action_plan} onChange={(e) => setF({ ...f, action_plan: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outstanding balance (EUR)"><Input type="number" value={f.outstanding_balance_eur} onChange={(e) => setF({ ...f, outstanding_balance_eur: e.target.value })} /></Field>
              <Field label="Quality notes"><Input value={f.quality_notes} onChange={(e) => setF({ ...f, quality_notes: e.target.value })} /></Field>
            </div>
            <Button onClick={save}>Save update</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-auto">
            {updates.map((u: any) => (
              <div key={u.id} className="border rounded-md p-3 text-sm">
                <div className="flex justify-between font-medium"><span>{u.topic}</span><span className="text-muted-foreground">Week of {u.week_of}</span></div>
                {u.challenges && <p className="mt-2"><b>Challenges:</b> {u.challenges}</p>}
                {u.ongoing_progress && <p><b>Progress:</b> {u.ongoing_progress}</p>}
                {u.action_plan && <p><b>Action plan:</b> {u.action_plan}</p>}
                {u.outstanding_balance_eur && <p><b>Outstanding:</b> {Number(u.outstanding_balance_eur).toLocaleString()} EUR</p>}
                {u.quality_notes && <p><b>Quality:</b> {u.quality_notes}</p>}
              </div>
            ))}
            {updates.length === 0 && <div className="text-muted-foreground text-sm">No updates yet.</div>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, children }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value} EUR</div>
    </div>
  );
}
