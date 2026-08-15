import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, Filter, Loader2, MessageSquareText, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { messageStatusTone } from "@/lib/campaign";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Message History — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "View delivery logs, timestamp history, and message details.",
      },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedMessage, setSelectedMessage] = useState<MessageRow | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, contacts(*), campaigns(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredMessages = messages.filter((m) => {
    const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.phone.toLowerCase().includes(q) ||
      (m.body && m.body.toLowerCase().includes(q)) ||
      (m.contacts?.name && m.contacts.name.toLowerCase().includes(q)) ||
      (m.campaigns?.name && m.campaigns.name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message History"
        description="Comprehensive delivery audit trail for sent WhatsApp broadcasts."
      />

      {/* Filter and Search controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search phone, recipient, body..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="SENT">SENT</SelectItem>
              <SelectItem value="DELIVERED">DELIVERED</SelectItem>
              <SelectItem value="READ">READ</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages Table */}
      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {messages.length === 0
              ? "No messages dispatched yet. Launch a campaign blast to generate history."
              : "No messages match your search filter."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Body Snippet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold">{m.contacts?.name || "Recipient"}</TableCell>
                  <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                  <TableCell className="text-xs">{m.campaigns?.name || "Direct Send"}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {m.body}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} tone={messageStatusTone[m.status]} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.sent_at
                      ? new Date(m.sent_at).toLocaleString()
                      : new Date(m.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setSelectedMessage(m)}
                    >
                      <Eye className="mr-1 size-3.5" /> Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message Delivery Details</DialogTitle>
          </DialogHeader>
          {selectedMessage ? (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Recipient: </span>
                  <strong className="block font-semibold">
                    {selectedMessage.contacts?.name || "Unknown"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <strong className="block font-mono">{selectedMessage.phone}</strong>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">Status: </span>
                <div className="mt-1">
                  <StatusBadge
                    status={selectedMessage.status}
                    tone={messageStatusTone[selectedMessage.status]}
                  />
                </div>
              </div>

              {selectedMessage.image_url ? (
                <div className="max-h-40 overflow-hidden rounded-lg border border-border">
                  <img
                    src={selectedMessage.image_url}
                    alt="Attached header"
                    className="w-full object-cover"
                  />
                </div>
              ) : null}

              <div>
                <span className="text-xs text-muted-foreground">Message Body:</span>
                <div className="mt-1 rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap font-sans">
                  {selectedMessage.body}
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border pt-3">
                {selectedMessage.sent_at ? (
                  <div>Sent: {new Date(selectedMessage.sent_at).toLocaleString()}</div>
                ) : null}
                {selectedMessage.delivered_at ? (
                  <div>Delivered: {new Date(selectedMessage.delivered_at).toLocaleString()}</div>
                ) : null}
                {selectedMessage.read_at ? (
                  <div>Read: {new Date(selectedMessage.read_at).toLocaleString()}</div>
                ) : null}
                {selectedMessage.error_message ? (
                  <div className="text-destructive font-semibold">
                    Error: {selectedMessage.error_message}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
