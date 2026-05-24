import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/project-context";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Factory, Package, TrendingUp, Truck, Download, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { generateProjectReport } from "@/lib/project-report";
import { toast } from "sonner";

const PIE_COLORS = ["#10b981", "#f59e0b"];

export const Route = createFileRoute("/app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { activeProject } = useProject();
  const pid = activeProject?.id;

  const { data: panels = [] } = useQuery({
    queryKey: ["panels", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("panels").select("*").eq("project_id", pid!)).data ?? [],
  });
  const { data: trackingCells = [] } = useQuery({
    queryKey: ["tracking_cells", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("tracking_cells").select("*").eq("project_id", pid!)).data ?? [],
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("deliveries").select("*").eq("project_id", pid!).order("delivery_date", { ascending: false }).limit(10)).data ?? [],
  });
  const { data: production = [] } = useQuery({
    queryKey: ["production-30", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("daily_production").select("*").eq("project_id", pid!).order("production_date", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: opUpdates = [] } = useQuery({
    queryKey: ["onepager-history", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("one_pager_updates").select("*").eq("project_id", pid!).order("week_of", { ascending: false })).data ?? [],
  });

  // Auto-derive produced TS per panel from tracking cells (2 PC = 1 TS)
  const pcByPanel = new Map<string, number>();
  for (const c of trackingCells as any[]) {
    pcByPanel.set(c.panel_id, (pcByPanel.get(c.panel_id) ?? 0) + Number(c.value || 0));
  }
  const producedByPanel = (id: string) => (pcByPanel.get(id) ?? 0) / 2;

  const poTotal = panels.reduce((s, p: any) => s + Number(p.price_eur || 0) * Number(p.po_quantity || 0), 0);
  const producedTotal = panels.reduce((s, p: any) => s + Number(p.price_eur || 0) * producedByPanel(p.id), 0);
  const balanceTotal = poTotal - producedTotal;
  const totalProduced = panels.reduce((s, p: any) => s + producedByPanel(p.id), 0);
  const totalPo = panels.reduce((s, p: any) => s + Number(p.po_quantity || 0), 0);
  const pct = totalPo ? Math.round((totalProduced / totalPo) * 100) : 0;

  if (!activeProject) return (
    <>
      <PageHeader title="Dashboard" description="Project overview, production progress and recent deliveries" />
      <Card><CardContent className="py-12 text-center text-muted-foreground">Create a project to get started.</CardContent></Card>
    </>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${activeProject.name} — updated daily`}
        actions={
          <DownloadReportButton
            project={activeProject}
          />
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat icon={Package} label="PO Total (EUR)" value={poTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Stat icon={Factory} label="Produced (EUR)" value={producedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Stat icon={TrendingUp} label="Balance (EUR)" value={balanceTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
        <Stat icon={Truck} label="Progress" value={`${pct}%`} extra={<Progress value={pct} className="mt-2" />} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoiced vs Balance (EUR)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Auto-calculated from panel prices × produced quantities.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]" data-report-chart="Invoiced vs Balance (EUR)">

            {poTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: "Invoiced", value: producedTotal }, { name: "Balance", value: Math.max(balanceTotal, 0) }]}
                    dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                    label={(e: any) => `${e.name}: ${Number(e.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  >
                    <Cell fill={PIE_COLORS[0]} />
                    <Cell fill={PIE_COLORS[1]} />
                  </Pie>
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " EUR"} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Add panels with price & PO quantity in Planning to see the chart.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {panels.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top panels — Produced vs PO (qty)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]" data-report-chart="Top panels - Produced vs PO">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...panels]
                    .map((p: any) => ({
                      name: p.tra_code || p.description?.slice(0, 12) || "—",
                      PO: Number(p.po_quantity || 0),
                      Produced: producedByPanel(p.id),
                    }))
                    .sort((a, b) => b.PO - a.PO)
                    .slice(0, 12)}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="PO" fill="#3b82f6" />
                  <Bar dataKey="Produced" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">

        <Card>
          <CardHeader><CardTitle>Panels — produced vs PO</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader><TableRow><TableHead>TRA</TableHead><TableHead>Description</TableHead><TableHead className="text-right">PO</TableHead><TableHead className="text-right">Produced</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {panels.map((p: any) => {
                    const prod = producedByPanel(p.id);
                    return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.tra_code}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{p.description}</TableCell>
                      <TableCell className="text-right">{p.po_quantity}</TableCell>
                      <TableCell className="text-right">{prod}</TableCell>
                      <TableCell className="text-right">{(p.po_quantity || 0) - prod}</TableCell>
                    </TableRow>
                    );
                  })}
                  {panels.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No panels yet — add some in Planning.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Last 30 days production</div>
              <div className="text-2xl font-semibold">{production.reduce((s, r: any) => s + Number(r.produced_qty || 0), 0)} <span className="text-sm font-normal text-muted-foreground">panels</span></div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Recent deliveries</div>
              <div className="space-y-1.5 text-sm">
                {deliveries.slice(0, 5).map((d: any) => (
                  <div key={d.id} className="flex justify-between border-b pb-1.5">
                    <span>{d.delivery_date} — {d.delivery_no || "—"}</span>
                    <span className="text-muted-foreground">{d.mode} • {d.total_qty || 0} pcs</span>
                  </div>
                ))}
                {deliveries.length === 0 && <div className="text-muted-foreground">No deliveries yet.</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>One-Pager updates history</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week of</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Challenges</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Action plan</TableHead>
                  <TableHead className="text-right">Outstanding (EUR)</TableHead>
                  <TableHead>Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opUpdates.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap">{u.week_of}</TableCell>
                    <TableCell className="whitespace-nowrap">{u.topic || "—"}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap text-xs">{u.challenges || "—"}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap text-xs">{u.ongoing_progress || "—"}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap text-xs">{u.action_plan || "—"}</TableCell>
                    <TableCell className="text-right">{u.outstanding_balance_eur != null ? Number(u.outstanding_balance_eur).toLocaleString() : "—"}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap text-xs">{u.quality_notes || "—"}</TableCell>
                  </TableRow>
                ))}
                {opUpdates.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No one-pager updates yet — add them in One-Pager.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DownloadReportButton({ project }: { project: any }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        try {
          setBusy(true);
          toast.info("Preparing project report…");
          await generateProjectReport(project);
          toast.success("Report downloaded");
        } catch (e: any) {
          console.error(e);
          toast.error(e?.message || "Failed to generate report");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
      Download Report
    </Button>
  );
}

function Stat({ icon: Icon, label, value, extra }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Icon className="size-5" /></div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{value}</div>
          </div>
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}
