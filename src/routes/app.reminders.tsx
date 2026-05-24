import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/app/reminders")({ component: Reminders });

function Reminders() {
  const { data: log = [] } = useQuery({
    queryKey: ["reminder_log"],
    queryFn: async () => (await supabase.from("reminder_log").select("*").order("sent_at", { ascending: false }).limit(100)).data ?? [],
  });

  return (
    <>
      <PageHeader title="Reminders" description="Active schedule and recent reminder history" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row label="One-Pager" when="Every Tuesday" />
            <Row label="Dashboard update" when="Daily" />
            <Row label="Daily production follow-up" when="Daily" />
            <Row label="Delivery tracker" when="Daily" />
            <Row label="Monthly costing" when="Last 2 days of each month" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent reminder log</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>For date</TableHead><TableHead>Channel</TableHead><TableHead>Sent at</TableHead></TableRow></TableHeader>
              <TableBody>
                {log.map((r: any) => (
                  <TableRow key={r.id}><TableCell>{r.reminder_type}</TableCell><TableCell>{r.triggered_for}</TableCell><TableCell>{r.channel}</TableCell><TableCell className="text-xs">{new Date(r.sent_at).toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, when }: { label: string; when: string }) {
  return <div className="flex justify-between border-b pb-2"><span>{label}</span><span className="text-muted-foreground">{when}</span></div>;
}
