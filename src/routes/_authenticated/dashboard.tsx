import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CheckCheck,
  Eye,
  ImageIcon,
  Megaphone,
  Plus,
  Send,
  Upload,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { campaignStatusTone } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "WhatsApp campaign metrics, contact counts, and broadcast status.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: contactsCount = 0 } = useQuery({
    queryKey: ["dashboard-contacts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["dashboard-recent-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: messagesStats = { totalSent: 0, delivered: 0, read: 0 } } = useQuery({
    queryKey: ["dashboard-messages-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("status");
      if (error) throw error;
      const totalSent = data?.length || 0;
      const delivered =
        data?.filter((m) => m.status === "DELIVERED" || m.status === "READ").length || 0;
      const read = data?.filter((m) => m.status === "READ").length || 0;
      return { totalSent, delivered, read };
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const deliveryRate = messagesStats.totalSent
    ? Math.round((messagesStats.delivered / messagesStats.totalSent) * 100)
    : 0;

  const readRate = messagesStats.totalSent
    ? Math.round((messagesStats.read / messagesStats.totalSent) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Monitor contact audience growth, WhatsApp broadcast campaigns, and delivery rates."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/contacts/import">
                <Upload className="mr-2 size-4" />
                Import Contacts
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/media">
                <ImageIcon className="mr-2 size-4" />
                Media Library
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/campaigns/new">
                <Plus className="mr-2 size-4" />
                New Campaign
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Contacts
            </CardTitle>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactsCount.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">Available for targeted broadcasts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Campaigns</CardTitle>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
              <Megaphone className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Recent & total campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Messages Sent
            </CardTitle>
            <div className="grid size-8 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600">
              <Send className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messagesStats.totalSent.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">{deliveryRate}% delivery rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Read Rate</CardTitle>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {messagesStats.read.toLocaleString()} messages read
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Recent Campaigns & Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Status and recipient counts for recent broadcasts.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/campaigns">
                View all <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No campaigns created yet. Click "New Campaign" to create your first broadcast.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/campaigns/$id"
                          params={{ id: c.id }}
                          className="font-semibold hover:underline"
                        >
                          {c.name}
                        </Link>
                        <StatusBadge status={c.status} tone={campaignStatusTone[c.status]} />
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{c.message}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-medium text-foreground">{c.total_recipients} recipients</p>
                      <p className="text-muted-foreground">
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "Not sent yet"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>System log audit trail.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/activity">
                Logs <ArrowUpRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No activity recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex gap-3 text-xs">
                    <div className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-muted">
                      <Activity className="size-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{log.action}</p>
                      <p className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
