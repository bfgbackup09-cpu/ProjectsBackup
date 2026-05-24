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
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { computeTraRow, invoicedByTra, type TraCostingRow } from "@/lib/tra-costing";

export const Route = createFileRoute("/app/costing")({ component: Costing });

function Costing() {
  const { activeProject } = useProject();
  const qc = useQueryClient();
  const pid = activeProject?.id;
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ scope: "FRP Panels", category: "Recurring cost", item: "", cost_eur: "", price_eur: "", notes: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["costing", pid, month], enabled: !!pid,
    queryFn: async () => (await supabase.from("costing_entries").select("*").eq("project_id", pid!).eq("month", `${month}-01`).order("created_at")).data ?? [],
  });

  const totals = rows.reduce((acc, r: any) => ({ cost: acc.cost + Number(r.cost_eur || 0), price: acc.price + Number(r.price_eur || 0) }), { cost: 0, price: 0 });
  const margin = totals.price - totals.cost;
  const marginPct = totals.price ? (margin / totals.price) * 100 : 0;

  const add = async () => {
    if (!f.item) { toast.error("Item required"); return; }
    const { error } = await supabase.from("costing_entries").insert({
      project_id: pid!, month: `${month}-01`, scope: f.scope, category: f.category, item: f.item,
      cost_eur: f.cost_eur ? Number(f.cost_eur) : 0, price_eur: f.price_eur ? Number(f.price_eur) : 0, notes: f.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Entry added"); setOpen(false);
    setF({ scope: "FRP Panels", category: "Recurring cost", item: "", cost_eur: "", price_eur: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["costing", pid, month] });
  };
  const remove = async (id: string) => { await supabase.from("costing_entries").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["costing", pid, month] }); };

  if (!activeProject) return (<><PageHeader title="Costing" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select a project.</CardContent></Card></>);

  return (
    <>
      <PageHeader title="Monthly Costing" description="Capture FRP, labour, packaging and logistics cost vs price"
        actions={
          <>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px]" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Add line</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add costing line</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 py-2">
                  <Field label="Scope"><Input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} /></Field>
                  <Field label="Category"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
                  <div className="col-span-2"><Field label="Item *"><Input value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="Average Cost FRP Material + Fit" /></Field></div>
                  <Field label="Cost (EUR)"><Input type="number" value={f.cost_eur} onChange={(e) => setF({ ...f, cost_eur: e.target.value })} /></Field>
                  <Field label="Price (EUR)"><Input type="number" value={f.price_eur} onChange={(e) => setF({ ...f, price_eur: e.target.value })} /></Field>
                  <div className="col-span-2"><Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
                </div>
                <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        } />

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Stat label="Total cost (EUR)" value={totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Stat label="Total price (EUR)" value={totals.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Stat label="Margin" value={`${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${marginPct.toFixed(1)}%)`} />
      </div>

      <TraBreakdown projectId={pid!} month={month} />

      <Card className="mt-6">
        <CardHeader><CardTitle>{month} entries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Scope</TableHead><TableHead>Category</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Cost (EUR)</TableHead><TableHead className="text-right">Price (EUR)</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.scope}</TableCell><TableCell>{r.category}</TableCell><TableCell>{r.item}</TableCell>
                  <TableCell className="text-right">{Number(r.cost_eur).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(r.price_eur).toFixed(2)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No entries for this month yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function TraBreakdown({ projectId, month }: { projectId: string; month: string }) {
  const qc = useQueryClient();

  const { data: panels = [] } = useQuery({
    queryKey: ["panels", projectId],
    queryFn: async () => (await supabase.from("panels").select("id,tra_code,description,line_no").eq("project_id", projectId).order("line_no")).data ?? [],
  });
  const { data: cols = [] } = useQuery({
    queryKey: ["tracking_columns", projectId],
    queryFn: async () => (await supabase.from("tracking_columns").select("id,column_date,invoice_no").eq("project_id", projectId)).data ?? [],
  });
  const { data: cells = [] } = useQuery({
    queryKey: ["tracking_cells", projectId],
    queryFn: async () => (await supabase.from("tracking_cells").select("panel_id,column_id,value").eq("project_id", projectId)).data ?? [],
  });
  const { data: stored = [], refetch } = useQuery({
    queryKey: ["costing_tra", projectId, month],
    queryFn: async () => (await supabase.from("costing_tra").select("*").eq("project_id", projectId).eq("month", `${month}-01`)).data ?? [],
  });

  const invMap = useMemo(
    () => invoicedByTra({ panels, tracking_columns: cols, tracking_cells: cells, month }),
    [panels, cols, cells, month],
  );

  const tras = useMemo(() => {
    // Union of TRAs that have invoicing in this month + any TRAs with stored rows.
    const set = new Set<string>();
    invMap.forEach((qty, tra) => { if (qty > 0) set.add(tra); });
    for (const s of stored as any[]) set.add(s.tra_code);
    return Array.from(set).sort();
  }, [invMap, stored]);

  const storedMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of stored as any[]) m.set(s.tra_code, s);
    return m;
  }, [stored]);

  const traDesc = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of panels as any[]) if (p.tra_code) m.set(p.tra_code, p.description ?? "");
    return m;
  }, [panels]);

  const rows: TraCostingRow[] = tras.map((tra) => {
    const s = storedMap.get(tra) ?? {};
    return {
      id: s.id,
      tra_code: tra,
      description: traDesc.get(tra) ?? "",
      invoiced_panels: invMap.get(tra) ?? 0,
      selling_unit_price_eur: Number(s.selling_unit_price_eur ?? 0),
      unit_material_cost_eur: Number(s.unit_material_cost_eur ?? 0),
      panel_labour_cost_eur: Number(s.panel_labour_cost_eur ?? 0),
      unit_packaging_labour_cost_eur: Number(s.unit_packaging_labour_cost_eur ?? 0),
    };
  });

  const computed = rows.map(computeTraRow);
  const sum = computed.reduce(
    (a, r) => ({
      invoiced: a.invoiced + r.invoiced_panels,
      selling: a.selling + r.selling_total_eur,
      material: a.material + r.total_material_eur,
      packaging: a.packaging + r.total_packaging_labour_eur,
      panelLab: a.panelLab + r.panel_labour_cost_eur,
      labour: a.labour + r.total_labour_eur,
      cost: a.cost + r.total_cost_eur,
    }),
    { invoiced: 0, selling: 0, material: 0, packaging: 0, panelLab: 0, labour: 0, cost: 0 },
  );
  const gMargin = sum.selling - sum.cost;
  const gMarginPct = sum.selling > 0 ? (gMargin / sum.selling) * 100 : 0;

  const save = async (tra: string, patch: Partial<TraCostingRow>) => {
    const existing = storedMap.get(tra);
    const payload: any = {
      project_id: projectId,
      month: `${month}-01`,
      tra_code: tra,
      selling_unit_price_eur: existing?.selling_unit_price_eur ?? 0,
      unit_material_cost_eur: existing?.unit_material_cost_eur ?? 0,
      panel_labour_cost_eur: existing?.panel_labour_cost_eur ?? 0,
      unit_packaging_labour_cost_eur: existing?.unit_packaging_labour_cost_eur ?? 0,
      ...patch,
    };
    const { error } = await supabase
      .from("costing_tra")
      .upsert(payload, { onConflict: "project_id,month,tra_code" });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["costing_tra", projectId, month] });
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>TRA breakdown — {month}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Invoiced panels are pulled automatically from the tracking sheet (columns with an invoice number in this month).
          Enter unit prices and labour costs; totals and gross margin update live.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TRA No.</TableHead>
              <TableHead className="text-right">Invoiced Panels</TableHead>
              <TableHead className="text-right">Selling Unit Price</TableHead>
              <TableHead className="text-right">Selling Total</TableHead>
              <TableHead className="text-right">Unit Material Cost</TableHead>
              <TableHead className="text-right">Total Material Cost</TableHead>
              <TableHead className="text-right">Panel Labour Cost</TableHead>
              <TableHead className="text-right">Unit Packaging Labour</TableHead>
              <TableHead className="text-right">Total Packaging Labour</TableHead>
              <TableHead className="text-right">Total Labour Cost</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">G-Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {computed.map((r) => (
              <TableRow key={r.tra_code}>
                <TableCell className="font-mono text-xs">{r.tra_code}</TableCell>
                <TableCell className="text-right">{r.invoiced_panels}</TableCell>
                <TableCell className="text-right p-1">
                  <NumCell value={r.selling_unit_price_eur} onSave={(v) => save(r.tra_code, { selling_unit_price_eur: v })} />
                </TableCell>
                <TableCell className="text-right">{fmt(r.selling_total_eur)}</TableCell>
                <TableCell className="text-right p-1">
                  <NumCell value={r.unit_material_cost_eur} onSave={(v) => save(r.tra_code, { unit_material_cost_eur: v })} />
                </TableCell>
                <TableCell className="text-right">{fmt(r.total_material_eur)}</TableCell>
                <TableCell className="text-right p-1">
                  <NumCell value={r.panel_labour_cost_eur} onSave={(v) => save(r.tra_code, { panel_labour_cost_eur: v })} />
                </TableCell>
                <TableCell className="text-right p-1">
                  <NumCell value={r.unit_packaging_labour_cost_eur} onSave={(v) => save(r.tra_code, { unit_packaging_labour_cost_eur: v })} />
                </TableCell>
                <TableCell className="text-right">{fmt(r.total_packaging_labour_eur)}</TableCell>
                <TableCell className="text-right">{fmt(r.total_labour_eur)}</TableCell>
                <TableCell className="text-right">{fmt(r.total_cost_eur)}</TableCell>
                <TableCell className={`text-right font-medium ${r.margin_eur >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmt(r.margin_eur)} ({r.margin_pct.toFixed(1)}%)
                </TableCell>
              </TableRow>
            ))}
            {computed.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">No invoiced panels in {month}. Invoice columns in the Tracking sheet to populate this table.</TableCell></TableRow>
            )}
            {computed.length > 0 && (
              <TableRow className="bg-amber-50/50 font-semibold">
                <TableCell>Totals</TableCell>
                <TableCell className="text-right">{sum.invoiced}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmt(sum.selling)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmt(sum.material)}</TableCell>
                <TableCell className="text-right">{fmt(sum.panelLab)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmt(sum.packaging)}</TableCell>
                <TableCell className="text-right">{fmt(sum.labour)}</TableCell>
                <TableCell className="text-right">{fmt(sum.cost)}</TableCell>
                <TableCell className={`text-right ${gMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {fmt(gMargin)} ({gMarginPct.toFixed(1)}%)
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {computed.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Stat label="Selling total (EUR)" value={fmt(sum.selling)} />
            <Stat label="Total cost (EUR)" value={fmt(sum.cost)} />
            <Stat label="G-Margin (EUR)" value={fmt(gMargin)} />
            <Stat label="G-Margin %" value={`${gMarginPct.toFixed(1)}%`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NumCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState<string>(String(value || ""));
  // Reset local state when value prop changes (e.g. month switch)
  useMemo(() => setLocal(String(value || "")), [value]);
  return (
    <Input
      type="number"
      step="0.01"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local || 0);
        if (n !== Number(value || 0)) onSave(n);
      }}
      className="h-8 w-28 text-right text-xs ml-auto"
    />
  );
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function Stat({ label, value }: any) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></CardContent></Card>;
}
function Field({ label, children }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
