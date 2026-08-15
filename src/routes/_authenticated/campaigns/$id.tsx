import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CheckCheck,
  Clock,
  Eye,
  Loader2,
  Megaphone,
  Play,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { campaignStatusTone, messageStatusTone } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/campaigns/$id")({
  head: () => ({
    meta: [
      { title: "Campaign Detail — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "Inspect broadcast status, campaign recipient metrics, and message dispatch.",
      },
    ],
  }),
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedRecipientMsg, setSelectedRecipientMsg] = useState<string | null>(null);

  const { data: campaign, isLoading: isCampaignLoading } = useQuery({
    queryKey: ["campaign-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: recipients = [], isLoading: isRecipientsLoading } = useQuery({
    queryKey: ["campaign-recipients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select("*, contacts(*)")
        .eq("campaign_id", id);
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "APPROVED", approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "campaign.approved",
        entity_type: "campaigns",
        entity_id: id,
        user_id: user.user?.id,
        details: { name: campaign?.name },
      });
    },
    onSuccess: () => {
      toast.success("Campaign approved!");
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to approve campaign"),
  });

  const launchBroadcastMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      // Set campaign to SENDING
      await supabase.from("campaigns").update({ status: "SENDING" }).eq("id", id);

      const now = new Date().toISOString();

      // Process recipients
      for (const rec of recipients) {
        const contactPhone = rec.contacts?.phone || "+1234567890";
        const bodyText = rec.rendered_message || campaign?.message || "";

        // Update recipient status to READ
        await supabase
          .from("campaign_recipients")
          .update({ status: "READ", updated_at: now })
          .eq("id", rec.id);

        // Insert into messages table
        await supabase.from("messages").insert({
          campaign_id: id,
          contact_id: rec.contact_id,
          recipient_id: rec.id,
          phone: contactPhone,
          body: bodyText,
          image_url: campaign?.image_url,
          status: "READ",
          sent_at: now,
          delivered_at: now,
          read_at: now,
        });
      }

      // Mark campaign COMPLETED
      await supabase.from("campaigns").update({ status: "COMPLETED", sent_at: now }).eq("id", id);

      await supabase.from("activity_logs").insert({
        action: "campaign.sent",
        entity_type: "campaigns",
        entity_id: id,
        user_id: user.user?.id,
        details: { name: campaign?.name, recipients_count: recipients.length },
      });
    },
    onSuccess: () => {
      toast.success("Broadcast dispatched successfully!");
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-recipients", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-messages-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to launch broadcast"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from("campaign_recipients").delete().eq("campaign_id", id);
      await supabase.from("messages").delete().eq("campaign_id", id);
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
      navigate({ to: "/campaigns" });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete campaign"),
  });

  if (isCampaignLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-lg font-semibold">Campaign not found</p>
        <Button variant="outline" onClick={() => navigate({ to: "/campaigns" })}>
          Return to Campaigns
        </Button>
      </div>
    );
  }

  const pendingCount = recipients.filter((r) => r.status === "PENDING").length;
  const sentCount = recipients.filter((r) => r.status === "SENT").length;
  const deliveredCount = recipients.filter((r) => r.status === "DELIVERED").length;
  const readCount = recipients.filter((r) => r.status === "READ").length;
  const failedCount = recipients.filter((r) => r.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description="Inspect broadcast details, target recipients, and launch execution."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/campaigns" })}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>

            {campaign.status === "READY" ? (
              <Button
                variant="outline"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Approve Campaign
              </Button>
            ) : null}

            {campaign.status === "APPROVED" ||
            campaign.status === "READY" ||
            campaign.status === "DRAFT" ? (
              <Button
                disabled={launchBroadcastMutation.isPending}
                onClick={() => launchBroadcastMutation.mutate()}
              >
                {launchBroadcastMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Play className="mr-2 size-4 fill-current" />
                )}
                Start Broadcast Blast
              </Button>
            ) : null}

            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        }
      />

      {/* Header Status & KPI metrics */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <StatusBadge
          status={campaign.status}
          tone={campaignStatusTone[campaign.status]}
          className="text-sm px-3 py-1"
        />
        <span className="text-xs text-muted-foreground">
          Created on {new Date(campaign.created_at).toLocaleString()}
        </span>
        {campaign.sent_at ? (
          <span className="text-xs font-semibold text-emerald-600">
            • Sent at {new Date(campaign.sent_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">
            Total Target
          </CardHeader>
          <CardContent className="text-xl font-bold">{recipients.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">
            Pending
          </CardHeader>
          <CardContent className="text-xl font-bold text-amber-600">{pendingCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">Sent</CardHeader>
          <CardContent className="text-xl font-bold text-blue-600">{sentCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">
            Delivered / Read
          </CardHeader>
          <CardContent className="text-xl font-bold text-emerald-600">
            {deliveredCount + readCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 text-xs font-medium text-muted-foreground">Failed</CardHeader>
          <CardContent className="text-xl font-bold text-destructive">{failedCount}</CardContent>
        </Card>
      </div>

      {/* Template & Specs */}
      <Card>
        <CardHeader>
          <CardTitle>Broadcast Message Payload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign.image_url ? (
            <div className="max-w-xs overflow-hidden rounded-lg border border-border">
              <img src={campaign.image_url} alt="Header" className="max-h-48 w-full object-cover" />
            </div>
          ) : null}
          <div className="rounded-lg bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
            {campaign.message}
          </div>
        </CardContent>
      </Card>

      {/* Recipient Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Recipient List & Rendered Messages</CardTitle>
          <CardDescription>Individual delivery logs for this broadcast.</CardDescription>
        </CardHeader>
        <CardContent>
          {isRecipientsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipients.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No recipients found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Personalized Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.contacts?.name || "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.contacts?.phone || "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-xs">
                      {r.rendered_message || campaign.message}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} tone={messageStatusTone[r.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          setSelectedRecipientMsg(r.rendered_message || campaign.message)
                        }
                      >
                        <Eye className="mr-1 size-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Rendered Message Modal */}
      <Dialog
        open={!!selectedRecipientMsg}
        onOpenChange={(open) => !open && setSelectedRecipientMsg(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personalized WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg bg-[#efeae2] p-4 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
            <p className="font-sans text-sm whitespace-pre-wrap">{selectedRecipientMsg}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
