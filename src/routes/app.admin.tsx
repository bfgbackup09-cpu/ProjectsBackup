import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-role";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Shield, ShieldOff, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

const HIDDEN_EMAILS = ["rail@bfginternational.com"];

function AdminPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [transferOpen, setTransferOpen] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState("");

  const { data: rawProfiles = [] } = useQuery({
    queryKey: ["all_profiles"], enabled: isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id, email, full_name").order("email")).data ?? [],
  });
  const profiles = (rawProfiles as any[]).filter(p => !HIDDEN_EMAILS.includes((p.email ?? "").toLowerCase()));
  const hiddenIds = new Set((rawProfiles as any[]).filter(p => HIDDEN_EMAILS.includes((p.email ?? "").toLowerCase())).map(p => p.id));

  const { data: rawRoles = [] } = useQuery({
    queryKey: ["all_roles"], enabled: isAdmin,
    queryFn: async () => (await supabase.from("user_roles").select("id, user_id, role")).data ?? [],
  });
  const roles = (rawRoles as any[]).filter(r => !hiddenIds.has(r.user_id));

  const { data: projects = [] } = useQuery({
    queryKey: ["all_projects_admin"], enabled: isAdmin,
    queryFn: async () => (await supabase.from("projects").select("id, name, created_by")).data ?? [],
  });
  const { data: rawMembers = [] } = useQuery({
    queryKey: ["all_members"], enabled: isAdmin,
    queryFn: async () => (await supabase.from("project_members").select("id, project_id, user_id")).data ?? [],
  });
  const members = (rawMembers as any[]).filter(m => !hiddenIds.has(m.user_id));

  if (!isAdmin) return (<><PageHeader title="Admin" /><Card><CardContent className="py-12 text-center text-muted-foreground">Admin access only.</CardContent></Card></>);

  const profileById = new Map((profiles as any[]).map(p => [p.id, p]));
  const isUserAdmin = (uid: string) => (roles as any[]).some(r => r.user_id === uid && r.role === "admin");

  const promote = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) { toast.error(error.message); return; }
    toast.success("Promoted to admin");
    qc.invalidateQueries({ queryKey: ["all_roles"] });
  };
  const demote = async (uid: string) => {
    if (!confirm("Remove admin rights?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) { toast.error(error.message); return; }
    toast.success("Admin rights removed");
    qc.invalidateQueries({ queryKey: ["all_roles"] });
  };
  const unassign = async (memberId: string) => {
    if (!confirm("Remove this assignment?")) return;
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment removed");
    qc.invalidateQueries({ queryKey: ["all_members"] });
  };
  const transfer = async (memberId: string) => {
    const email = transferEmail.trim().toLowerCase();
    if (!email) return;
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) { toast.error("No user with that email"); return; }
    const { error } = await supabase.from("project_members").update({ user_id: prof.id }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment switched");
    setTransferOpen(null); setTransferEmail("");
    qc.invalidateQueries({ queryKey: ["all_members"] });
  };
  const assignProject = async (projectId: string, userId: string) => {
    if (!userId) return;
    const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: userId });
    if (error) { toast.error(error.message); return; }
    toast.success("Assigned");
    qc.invalidateQueries({ queryKey: ["all_members"] });
  };

  return (
    <>
      <PageHeader title="Admin Panel" description="Manage admins, project assignments and employees." />

      <Card className="mb-6">
        <CardHeader><CardTitle>Users & Admin Rights</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(profiles as any[]).map(p => {
                const admin = isUserAdmin(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.email}</TableCell>
                    <TableCell>{p.full_name}</TableCell>
                    <TableCell>{admin ? <span className="text-primary font-semibold">Admin</span> : "User"}</TableCell>
                    <TableCell className="text-right">
                      {admin
                        ? <Button size="sm" variant="outline" onClick={() => demote(p.id)}><ShieldOff className="size-4 mr-1" />Remove admin</Button>
                        : <Button size="sm" onClick={() => promote(p.id)}><Shield className="size-4 mr-1" />Make admin</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Project Assignments (Employees on projects)</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {(projects as any[]).map(proj => {
            const ms = (members as any[]).filter(m => m.project_id === proj.id);
            const owner: any = profileById.get(proj.created_by);
            return (
              <div key={proj.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{proj.name}</div>
                    <div className="text-xs text-muted-foreground">Owner: {owner?.email ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(uid) => assignProject(proj.id, uid)}>
                      <SelectTrigger className="w-[240px] h-8 text-xs"><SelectValue placeholder="+ Assign employee" /></SelectTrigger>
                      <SelectContent>
                        {(profiles as any[])
                          .filter(p => !ms.some(m => m.user_id === p.id) && p.id !== proj.created_by)
                          .map(p => <SelectItem key={p.id} value={p.id}>{p.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {ms.length === 0 && <div className="text-xs text-muted-foreground">No employees assigned.</div>}
                {ms.map(m => {
                  const prof: any = profileById.get(m.user_id);
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm py-1 border-t">
                      <span>{prof?.email ?? m.user_id}</span>
                      <div className="flex items-center gap-2">
                        {transferOpen === m.id ? (
                          <>
                            <Input className="h-7 text-xs w-48" placeholder="new user email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)} />
                            <Button size="sm" onClick={() => transfer(m.id)}>Switch</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setTransferOpen(null); setTransferEmail(""); }}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setTransferOpen(m.id)}><ArrowRightLeft className="size-4 mr-1" />Switch</Button>
                            <Button size="icon" variant="ghost" onClick={() => unassign(m.id)}><Trash2 className="size-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {(projects as any[]).length === 0 && <div className="text-sm text-muted-foreground">No projects yet.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Employees Working on Projects</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Projects</TableHead></TableRow></TableHeader>
            <TableBody>
              {(profiles as any[]).map(p => {
                const assigned = (members as any[]).filter(m => m.user_id === p.id).map(m => (projects as any[]).find(pr => pr.id === m.project_id)?.name).filter(Boolean);
                const owned = (projects as any[]).filter(pr => pr.created_by === p.id).map(pr => pr.name + " (owner)");
                const all = [...owned, ...assigned];
                if (all.length === 0) return null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.email}</TableCell>
                    <TableCell className="text-sm">{all.join(", ")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
