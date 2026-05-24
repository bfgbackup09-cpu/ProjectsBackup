import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/project-context";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { exportSheets } from "@/lib/xlsx-export";

export const Route = createFileRoute("/app/tracking")({ component: Tracking });

function Tracking() {
  const { activeProject } = useProject();
  const qc = useQueryClient();
  const pid = activeProject?.id;

  const { data: panels = [] } = useQuery({
    queryKey: ["panels", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("panels").select("*").eq("project_id", pid!).order("line_no")).data ?? [],
  });
  const { data: columns = [] } = useQuery({
    queryKey: ["tracking_columns", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("tracking_columns").select("*").eq("project_id", pid!).order("position")).data ?? [],
  });
  const { data: cells = [] } = useQuery({
    queryKey: ["tracking_cells", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("tracking_cells").select("*").eq("project_id", pid!)).data ?? [],
  });

  if (!activeProject) return (<><PageHeader title="Tracking Sheet" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select or create a project first.</CardContent></Card></>);

  const cellMap = new Map<string, { id: string; value: number }>();
  for (const c of cells as any[]) cellMap.set(`${c.panel_id}::${c.column_id}`, { id: c.id, value: c.value });

  const addColumn = async () => {
    const nextPos = ((columns as any[]).at(-1)?.position ?? 0) + 1;
    const { error } = await supabase.from("tracking_columns").insert({ project_id: pid!, label: "", position: nextPos, column_date: new Date().toISOString().slice(0, 10) } as any);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tracking_columns", pid] });
  };

  const duplicateColumn = async (col: any) => {
    // Shift all columns after the source one position down to make room beside it
    const after = (columns as any[]).filter(c => c.position > col.position).sort((a,b) => b.position - a.position);
    for (const c of after) {
      await (supabase as any).from("tracking_columns").update({ position: c.position + 1 }).eq("id", c.id);
    }
    // Insert new column at adjacent position, sharing date/invoice/delivery for clarity
    const { data: newCol, error } = await supabase.from("tracking_columns").insert({
      project_id: pid!, label: "", position: col.position + 1,
      column_date: new Date().toISOString().slice(0, 10),
      invoice_no: col.invoice_no, delivery_note: col.delivery_note,
    } as any).select().single();
    if (error || !newCol) { toast.error(error?.message ?? "Error"); return; }
    // copy cell values
    const sourceCells = (cells as any[]).filter(c => c.column_id === col.id && c.value > 0);
    if (sourceCells.length) {
      await supabase.from("tracking_cells").insert(
        sourceCells.map(c => ({ project_id: pid!, panel_id: c.panel_id, column_id: newCol.id, value: c.value }))
      );
    }
    qc.invalidateQueries({ queryKey: ["tracking_columns", pid] });
    qc.invalidateQueries({ queryKey: ["tracking_cells", pid] });
    toast.success("PC column duplicated");
  };

  const removeColumn = async (id: string) => {
    if (!confirm("Delete this column? Its values will be removed.")) return;
    const { error } = await supabase.from("tracking_columns").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tracking_columns", pid] });
    qc.invalidateQueries({ queryKey: ["tracking_cells", pid] });
    qc.invalidateQueries({ queryKey: ["panels", pid] });
    qc.invalidateQueries({ queryKey: ["prod", pid] });
    qc.invalidateQueries({ queryKey: ["mm", pid] });
  };

  const updateColumnField = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("tracking_columns").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tracking_columns", pid] });
    qc.invalidateQueries({ queryKey: ["prod", pid] });
    qc.invalidateQueries({ queryKey: ["mm", pid] });
  };

  const setCellValue = async (panelId: string, columnId: string, newVal: number) => {
    const key = `${panelId}::${columnId}`;
    const existing = cellMap.get(key);
    // Optimistic cache update — no refetch, no lag
    qc.setQueryData(["tracking_cells", pid], (old: any[] = []) => {
      if (existing) {
        return old.map((c) => (c.id === existing.id ? { ...c, value: newVal } : c));
      }
      return [...old, { id: `tmp-${key}`, panel_id: panelId, column_id: columnId, value: newVal, project_id: pid }];
    });
    if (existing && !String(existing.id).startsWith("tmp-")) {
      const { error } = await supabase.from("tracking_cells").update({ value: newVal, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["tracking_cells", pid] }); }
    } else {
      const { data, error } = await supabase.from("tracking_cells").insert({ project_id: pid!, panel_id: panelId, column_id: columnId, value: newVal }).select().single();
      if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["tracking_cells", pid] }); return; }
      // Replace temp id with real one
      qc.setQueryData(["tracking_cells", pid], (old: any[] = []) =>
        old.map((c) => (c.id === `tmp-${key}` ? { ...c, id: data.id } : c))
      );
    }
  };
  const increment = (panelId: string, columnId: string) => {
    const v = cellMap.get(`${panelId}::${columnId}`)?.value ?? 0;
    setCellValue(panelId, columnId, v + 1);
  };
  const resetCell = (panelId: string, columnId: string) => {
    setCellValue(panelId, columnId, 0);
  };

  const rowTotal = (panelId: string) =>
    (columns as any[]).reduce((s, c) => s + (cellMap.get(`${panelId}::${c.id}`)?.value ?? 0), 0);
  const colTotal = (columnId: string) =>
    (panels as any[]).reduce((s, p) => s + (cellMap.get(`${p.id}::${columnId}`)?.value ?? 0), 0);
  const grandTotal = (panels as any[]).reduce((s, p) => s + rowTotal(p.id), 0);

  return (
    <>
      <PageHeader
        title="Tracking Sheet"
        description="Mark each PC as it gets invoiced — totals auto-feed Daily Production & Manufacturing."
        actions={<>
          <Button size="sm" variant="outline" onClick={() => {
            const cols = columns as any[];
            const colName = (c: any) => c.column_date || `#${c.position}`;
            const rows = (panels as any[]).map((p) => {
              const row: any = { "TRA code": p.tra_code, Description: p.description };
              for (const c of cols) row[colName(c)] = cellMap.get(`${p.id}::${c.id}`)?.value ?? 0;
              row.Total = rowTotal(p.id);
              return row;
            });
            const totalRow: any = { "TRA code": "Column total", Description: "" };
            for (const c of cols) totalRow[colName(c)] = colTotal(c.id);
            totalRow.Total = grandTotal;
            rows.push(totalRow);
            const meta = cols.map((c) => ({ Date: c.column_date, Invoice: c.invoice_no, "Delivery note": c.delivery_note }));
            exportSheets(`tracking-${activeProject.name}.xlsx`, [
              { name: "Tracking", rows }, { name: "Columns", rows: meta },
            ]);
          }}><Download className="size-4 mr-1" />Excel</Button>
          <Button size="sm" onClick={addColumn}><Plus className="size-4 mr-1" />Add PC column</Button>
        </>}
      />
      <Card>
        <CardHeader><CardTitle>Panels × PCs ({(columns as any[]).length} columns)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Panel TRA No.</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  {(columns as any[]).map((c) => (
                    <TableHead key={c.id} className="text-center min-w-[150px] align-top">
                      <div className="flex flex-col gap-1 items-center py-1">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => duplicateColumn(c)} className="text-muted-foreground hover:text-primary" title="Duplicate PC column">
                            <Copy className="size-3" />
                          </button>
                          <button onClick={() => removeColumn(c.id)} className="text-muted-foreground hover:text-destructive" title="Delete column">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                        <Input type="date" defaultValue={c.column_date ?? ""} onBlur={(e) => updateColumnField(c.id, { column_date: e.target.value || null })} className="h-7 text-xs" />
                        <Input placeholder="Invoice #" defaultValue={c.invoice_no ?? ""} onBlur={(e) => updateColumnField(c.id, { invoice_no: e.target.value || null })} className="h-7 text-xs" />
                        <Input placeholder="Delivery note" defaultValue={c.delivery_note ?? ""} onBlur={(e) => updateColumnField(c.id, { delivery_note: e.target.value || null })} className="h-7 text-xs" />
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right sticky right-0 bg-background z-10">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(panels as any[]).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs sticky left-0 bg-background">{p.tra_code}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs">{p.description}</TableCell>
                    {(columns as any[]).map((c) => {
                      const v = cellMap.get(`${p.id}::${c.id}`)?.value ?? 0;
                      return (
                        <TableCell key={c.id} className="text-center p-1">
                          <button
                            onClick={() => increment(p.id, c.id)}
                            onContextMenu={(e) => { e.preventDefault(); resetCell(p.id, c.id); }}
                            title="Click to increment • Right-click to reset"
                            className={`w-10 h-8 rounded text-sm font-medium transition-colors ${
                              v > 0 ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                            }`}
                          >{v > 0 ? v : ""}</button>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold sticky right-0 bg-background">{rowTotal(p.id)}</TableCell>
                  </TableRow>
                ))}
                {(panels as any[]).length === 0 && (
                  <TableRow><TableCell colSpan={(columns as any[]).length + 3} className="text-center py-8 text-muted-foreground">Add panels in Planning first.</TableCell></TableRow>
                )}
                {(panels as any[]).length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell className="sticky left-0 bg-muted/40">Column total</TableCell>
                    <TableCell></TableCell>
                    {(columns as any[]).map((c) => (
                      <TableCell key={c.id} className="text-center">{colTotal(c.id)}</TableCell>
                    ))}
                    <TableCell className="text-right sticky right-0 bg-muted/40">{grandTotal}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {(columns as any[]).length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-4">No PC columns yet. Click "Add PC column" each time you invoice a new PC batch.</p>
          )}
        </CardContent>
      </Card>

      <GanttChart panels={panels as any[]} columns={columns as any[]} cellMap={cellMap} totalTrainsets={Number(activeProject.trainsets ?? 0)} />
    </>
  );
}

function GanttChart({ panels, columns, cellMap, totalTrainsets }: { panels: any[]; columns: any[]; cellMap: Map<string, { id: string; value: number }>; totalTrainsets: number }) {
  // Build per-panel timeline: earliest dated column with value=1 -> latest; PC count -> TS = PC/2
  const dated = columns.filter(c => c.column_date).sort((a, b) => a.column_date.localeCompare(b.column_date));
  if (!dated.length || !panels.length) {
    return (
      <Card className="mt-6">
        <CardHeader><CardTitle>Gantt — Panels Timeline (2 PC = 1 TS)</CardTitle></CardHeader>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Add dated PC columns and mark cells to see the Gantt timeline.</CardContent>
      </Card>
    );
  }
  const minDate = new Date(dated[0].column_date).getTime();
  const maxDate = new Date(dated[dated.length - 1].column_date).getTime();
  const span = Math.max(1, maxDate - minDate);

  const rows = panels.map(p => {
    const hits = dated
      .map(c => ({ date: new Date(c.column_date).getTime(), v: cellMap.get(`${p.id}::${c.id}`)?.value ?? 0, dateStr: c.column_date }))
      .filter(h => h.v > 0);
    if (!hits.length) return null;
    const start = hits[0].date;
    const end = hits[hits.length - 1].date;
    const pcCount = hits.reduce((s, h) => s + h.v, 0);
    const ts = pcCount / 2;
    const leftPct = ((start - minDate) / span) * 100;
    const widthPct = Math.max(2, ((end - start) / span) * 100);
    return { p, start, end, pcCount, ts, leftPct, widthPct, hits };
  }).filter(Boolean) as any[];

  // PC completion: 1 PC is finished only when every panel in a column has qty >= n.
  // PCs per column = min(value across all panels). Total PC = sum across columns. TS = PC / 2.
  const pcPerColumn = dated.map(c => {
    if (!panels.length) return 0;
    let min = Infinity;
    for (const p of panels) {
      const v = cellMap.get(`${p.id}::${c.id}`)?.value ?? 0;
      if (v < min) min = v;
    }
    return min === Infinity ? 0 : min;
  });
  const totalPC = pcPerColumn.reduce((s, n) => s + n, 0);
  const totalTS = totalPC / 2;

  const colorFor = (i: number) => {
    const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    return palette[i % palette.length];
  };

  const fmt = (ts: number) => new Date(ts).toLocaleDateString();

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Gantt — Panels Timeline (2 PC = 1 TS)</CardTitle>
        <p className="text-xs text-muted-foreground">Each bar shows when PCs for that panel were invoiced. TS = PC ÷ 2.</p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-xs text-muted-foreground mb-2 px-[200px]">
          <span>{fmt(minDate)}</span>
          <span>{fmt(maxDate)}</span>
        </div>
        <div className="space-y-1">
          {rows.map((r, i) => (
            <div key={r.p.id} className="flex items-center gap-2 text-xs">
              <div className="w-[140px] truncate font-mono">{r.p.tra_code}</div>
              <div className="w-[60px] text-right">{r.pcCount} PC</div>
              <div className="w-[60px] text-right font-semibold text-primary">{r.ts} TS</div>
              <div className="flex-1 relative h-6 bg-muted/30 rounded">
                <div
                  className="absolute h-full rounded flex items-center justify-center text-[10px] text-white font-medium px-1 overflow-hidden"
                  style={{ left: `${r.leftPct}%`, width: `${r.widthPct}%`, background: colorFor(i), minWidth: "8px" }}
                  title={`${r.p.tra_code}: ${fmt(r.start)} → ${fmt(r.end)} • ${r.pcCount} PC • ${r.ts} TS`}
                >
                  {r.widthPct > 12 ? `${fmt(r.start)} → ${fmt(r.end)}` : ""}
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No invoiced PCs yet.</div>}
        </div>
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 text-sm">
          <div>Total PCs: <span className="font-semibold">{totalPC}</span></div>
          <div>Completed TS: <span className="font-semibold text-primary">{totalTS}</span></div>
          <div>Total TS (project): <span className="font-semibold">{totalTrainsets || "—"}</span></div>
          {totalTrainsets > 0 && (
            <div>Remaining TS: <span className="font-semibold text-amber-600">{Math.max(0, totalTrainsets - totalTS)}</span></div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
