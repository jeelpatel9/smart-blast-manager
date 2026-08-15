import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Eye, Filter, Loader2, Megaphone, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { campaignStatusTone } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "List and manage WhatsApp broadcast campaigns and delivery workflows.",
      },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deletingCampaign, setDeletingCampaign] = useState<CampaignRow | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (campaign: CampaignRow) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("campaigns")
        .update({
          status: "APPROVED",
          approved_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "campaign.approved",
        entity_type: "campaigns",
        entity_id: campaign.id,
        user_id: user.user?.id ?? null,
        details: { name: campaign.name },
      });
    },
    onSuccess: () => {
      toast.success("Campaign approved!");
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve campaign"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingCampaign) return;
      // Delete campaign recipients and messages
      await supabase.from("campaign_recipients").delete().eq("campaign_id", deletingCampaign.id);
      await supabase.from("messages").delete().eq("campaign_id", deletingCampaign.id);
      const { error } = await supabase.from("campaigns").delete().eq("id", deletingCampaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
      setDeletingCampaign(null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete campaign"),
  });

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q || c.name.toLowerCase().includes(q) || c.message.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="View status, review drafts, approve broadcasts, and launch WhatsApp campaigns."
        actions={
          <Button asChild>
            <Link to="/campaigns/new">
              <Plus className="mr-2 size-4" />
              Create Campaign
            </Link>
          </Button>
        }
      />

      {/* Filter and Search controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="DRAFT">DRAFT</SelectItem>
              <SelectItem value="READY">READY</SelectItem>
              <SelectItem value="APPROVED">APPROVED</SelectItem>
              <SelectItem value="SENDING">SENDING</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {campaigns.length === 0
              ? "No campaigns created yet. Click 'Create Campaign' to launch a broadcast."
              : "No campaigns match the selected filters."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Message Preview</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">
                    <Link to="/campaigns/$id" params={{ id: c.id }} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} tone={campaignStatusTone[c.status]} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.total_recipients} contacts</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {c.message}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.status === "READY" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-primary"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(c)}
                        >
                          <CheckCircle2 className="mr-1 size-3.5" /> Approve
                        </Button>
                      ) : null}
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/campaigns/$id" params={{ id: c.id }}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingCampaign(c)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!deletingCampaign}
        onOpenChange={(open) => !open && setDeletingCampaign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete campaign <strong>{deletingCampaign?.name}</strong>?
              Associated message history and recipient records will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
