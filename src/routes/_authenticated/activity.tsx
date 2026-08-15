import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, Code, Loader2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Logs — WhatsApp Campaign Manager" },
      { name: "description", content: "Audit trail and event log of admin operations in Smart Blast Manager." },
    ],
  }),
  component: ActivityLogsPage,
});

function ActivityLogsPage() {
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      !q ||
      log.action.toLowerCase().includes(q) ||
      (log.entity_type && log.entity_type.toLowerCase().includes(q)) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Activity Logs"
        description="Audit trail recording contact imports, campaign creations, approvals, and message dispatches."
      />

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by action, entity type..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No activity logs found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{log.action}</TableCell>
                  <TableCell className="text-xs">{log.entity_type || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.entity_id ? log.entity_id.slice(0, 8) + "..." : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedLog(log)}>
                      <Code className="mr-1 size-3.5" /> Payload
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* JSON Payload Inspector Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activity JSON Details</DialogTitle>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 dark:bg-slate-900">
            {JSON.stringify(selectedLog, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
