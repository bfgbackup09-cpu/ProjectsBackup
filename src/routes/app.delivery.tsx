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
import { useState } from "react";
import { toast } from "sonner";
import { exportSheets } from "@/lib/xlsx-export";

export const Route = createFileRoute("/app/delivery")({ component: Delivery });

function Delivery() {
  const { activeProject } = useProject();
  const qc = useQueryClient();
  const pid = activeProject?.id;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ delivery_date: new Date().toISOString().slice(0, 10), mode: "SEA", delivery_no: "", invoice_no: "", box_no: "", trainset: "", total_qty: "", total_value_eur: "", comments: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["deliveries", pid], enabled: !!pid,
    queryFn: async () => (await supabase.from("deliveries").select("*").eq("project_id", pid!).order("delivery_date", { ascending: false })).data ?? [],
  });

  const add = async () => {
    if (!f.delivery_no) { toast.error("Delivery no. required"); return; }
    const { error } = await supabase.from("deliveries").insert({
      project_id: pid!, delivery_date: f.delivery_date, mode: f.mode, delivery_no: f.delivery_no,
      invoice_no: f.invoice_no || null, box_no: f.box_no || null, trainset: f.trainset || null,
      total_qty: f.total_qty ? Number(f.total_qty) : 0, total_value_eur: f.total_value_eur ? Number(f.total_value_eur) : 0, comments: f.comments || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery added");
    setOpen(false); setF({ ...f, delivery_no: "", invoice_no: "", box_no: "", trainset: "", total_qty: "", total_value_eur: "", comments: "" });
    qc.invalidateQueries({ queryKey: ["deliveries", pid] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("deliveries").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["deliveries", pid] });
  };

  if (!activeProject) return (<><PageHeader title="Delivery Tracker" /><Card><CardContent className="py-12 text-center text-muted-foreground">Select a project.</CardContent></Card></>);

  return (
    <>
      <PageHeader title="Delivery Tracker" description="Update daily — date, mode, delivery and invoice numbers" actions={<>
        <Button size="sm" variant="outline" onClick={() => exportSheets(`deliveries-${activeProject.name}.xlsx`, [{
          name: "Deliveries", rows: (rows as any[]).map((r) => ({
            Date: r.delivery_date, Mode: r.mode, "Delivery no": r.delivery_no, "Invoice no": r.invoice_no,
            "Box no": r.box_no, Trainset: r.trainset, Qty: r.total_qty, "Value (EUR)": r.total_value_eur, Comments: r.comments,
          })),
        }])}><Download className="size-4 mr-1" />Excel</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />New delivery</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Log delivery</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <Field label="Date"><Input type="date" value={f.delivery_date} onChange={(e) => setF({ ...f, delivery_date: e.target.value })} /></Field>
              <Field label="Mode"><Input value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} placeholder="SEA / AIR" /></Field>
              <Field label="Delivery no. *"><Input value={f.delivery_no} onChange={(e) => setF({ ...f, delivery_no: e.target.value })} /></Field>
              <Field label="Invoice no."><Input value={f.invoice_no} onChange={(e) => setF({ ...f, invoice_no: e.target.value })} /></Field>
              <Field label="Box no."><Input value={f.box_no} onChange={(e) => setF({ ...f, box_no: e.target.value })} /></Field>
              <Field label="Trainset"><Input value={f.trainset} onChange={(e) => setF({ ...f, trainset: e.target.value })} placeholder="TS-6" /></Field>
              <Field label="Total qty"><Input type="number" value={f.total_qty} onChange={(e) => setF({ ...f, total_qty: e.target.value })} /></Field>
              <Field label="Value (EUR)"><Input type="number" value={f.total_value_eur} onChange={(e) => setF({ ...f, total_value_eur: e.target.value })} /></Field>
              <div className="col-span-2"><Field label="Comments"><Input value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field></div>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </>} />
      <Card>
        <CardHeader><CardTitle>Deliveries ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Delivery</TableHead><TableHead>Invoice</TableHead><TableHead>Trainset</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value (EUR)</TableHead><TableHead>Comments</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.delivery_date}</TableCell><TableCell>{r.mode}</TableCell>
                  <TableCell className="font-mono text-xs">{r.delivery_no}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_no}</TableCell>
                  <TableCell>{r.trainset}</TableCell>
                  <TableCell className="text-right">{r.total_qty}</TableCell>
                  <TableCell className="text-right">{Number(r.total_value_eur || 0).toLocaleString()}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{r.comments}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No deliveries logged yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, children }: any) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
