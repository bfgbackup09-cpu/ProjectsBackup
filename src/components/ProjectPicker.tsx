import { useProject } from "@/lib/project-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin } from "@/lib/use-role";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function ProjectPicker() {
  const { projects, activeProject, setActiveProjectId, refetch } = useProject();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [form, setForm] = useState({ name: "", customer: "", end_customer: "", oem: "", site: "", scope: "", po_fe: "", po_cab: "", trainsets: "" });

  const { data: members = [] } = useQuery({
    queryKey: ["project_members", activeProject?.id],
    enabled: !!activeProject?.id && isAdmin && shareOpen,
    queryFn: async () => {
      const { data: pm } = await supabase.from("project_members").select("id, user_id").eq("project_id", activeProject!.id);
      const ids = (pm ?? []).map((m: any) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
      return (pm ?? []).map((m: any) => ({ ...m, profile: profs?.find((p: any) => p.id === m.user_id) }));
    },
  });

  const create = async () => {
    if (!form.name.trim()) { toast.error("Project name is required"); return; }
    const { data, error } = await supabase.from("projects").insert({
      name: form.name.trim(),
      customer: form.customer || null, end_customer: form.end_customer || null,
      oem: form.oem || null, site: form.site || null, scope: form.scope || null,
      po_fe: form.po_fe || null, po_cab: form.po_cab || null,
      trainsets: form.trainsets ? Number(form.trainsets) : null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    await refetch();
    if (data) setActiveProjectId(data.id);
    setOpen(false);
    setForm({ name: "", customer: "", end_customer: "", oem: "", site: "", scope: "", po_fe: "", po_cab: "", trainsets: "" });
  };

  const remove = async () => {
    if (!activeProject) return;
    if (!confirm(`Delete project "${activeProject.name}"? This will remove all related data and cannot be undone.`)) return;
    const pid = activeProject.id;
    const tables = ["tracking_cells","tracking_columns","panels","deliveries","costing_entries","monthly_plans","daily_plans","daily_production","one_pager_financials","one_pager_updates","ecr_status","monthly_manufacturing","outstanding_balance_weekly","project_members"] as const;
    for (const t of tables) { await supabase.from(t as any).delete().eq("project_id", pid); }
    const { error } = await supabase.from("projects").delete().eq("id", pid);
    if (error) { toast.error(error.message); return; }
    toast.success("Project deleted");
    localStorage.removeItem("active_project_id");
    await refetch();
  };

  const assignUser = async () => {
    if (!activeProject || !shareEmail.trim()) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", shareEmail.trim().toLowerCase()).maybeSingle();
    if (!prof) { toast.error("No user found with that email — they must sign up first"); return; }
    const { error } = await supabase.from("project_members").insert({ project_id: activeProject.id, user_id: prof.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Project shared with " + shareEmail);
    setShareEmail("");
    qc.invalidateQueries({ queryKey: ["project_members", activeProject.id] });
  };

  const unassign = async (id: string) => {
    await supabase.from("project_members").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["project_members", activeProject?.id] });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={activeProject?.id ?? ""} onValueChange={setActiveProjectId}>
        <SelectTrigger className="w-[260px]"><SelectValue placeholder="Select project" /></SelectTrigger>
        <SelectContent>
          {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          {projects.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet</div>}
        </SelectContent>
      </Select>

      {isAdmin && activeProject && (
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" title="Assign project to user"><UserPlus className="size-4" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign "{activeProject.name}"</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="user@example.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                <Button onClick={assignUser}>Assign</Button>
              </div>
              <div className="text-xs text-muted-foreground">User must already have signed up.</div>
              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs">Currently assigned</Label>
                {(members as any[]).length === 0 && <div className="text-xs text-muted-foreground">No one assigned yet.</div>}
                {(members as any[]).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span>{m.profile?.email ?? m.user_id}</span>
                    <Button size="icon" variant="ghost" onClick={() => unassign(m.id)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && activeProject && (
        <Button variant="outline" size="icon" onClick={remove} title="Delete project" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      )}

      {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline" size="icon"><Plus className="size-4" /></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <Field label="Project name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MSW1 NAHSH" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer (OEM client)"><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Alstom" /></Field>
                <Field label="End customer"><Input value={form.end_customer} onChange={(e) => setForm({ ...form, end_customer: e.target.value })} placeholder="Deutsche Bahn" /></Field>
                <Field label="OEM"><Input value={form.oem} onChange={(e) => setForm({ ...form, oem: e.target.value })} placeholder="Alstom Transport" /></Field>
                <Field label="Site"><Input value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} placeholder="Salzgitter, Germany" /></Field>
                <Field label="PO (Front End)"><Input value={form.po_fe} onChange={(e) => setForm({ ...form, po_fe: e.target.value })} /></Field>
                <Field label="PO (CAB)"><Input value={form.po_cab} onChange={(e) => setForm({ ...form, po_cab: e.target.value })} /></Field>
                <Field label="Scope"><Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Front end and CAB" /></Field>
                <Field label="Trainsets"><Input type="number" value={form.trainsets} onChange={(e) => setForm({ ...form, trainsets: e.target.value })} /></Field>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create project</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
