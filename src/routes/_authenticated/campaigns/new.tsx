import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, Check, Image as ImageIcon, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { renderTemplate, SUPPORTED_VARIABLES } from "@/lib/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type MediaRow = Database["public"]["Tables"]["media"]["Row"];

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    template: typeof search.template === "string" ? search.template : undefined,
  }),
  head: () => ({
    meta: [
      { title: "New Campaign — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "Create a new broadcast campaign with personalized WhatsApp variables.",
      },
    ],
  }),
  component: NewCampaignPage,
});

function NewCampaignPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_authenticated/campaigns/new" });
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState(
    searchParams.template || "Hi {{name}}! We have an exclusive update for your {{product}} plan.",
  );
  const [targetStatus, setTargetStatus] = useState<string>("ACTIVE");
  const [targetProduct, setTargetProduct] = useState<string>("ALL");

  const { data: mediaList = [] } = useQuery({
    queryKey: ["media-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter targeted recipients
  const targetedContacts = contacts.filter((c) => {
    const matchesStatus = targetStatus === "ALL" || c.status === targetStatus;
    const matchesProduct = targetProduct === "ALL" || c.product === targetProduct;
    return matchesStatus && matchesProduct;
  });

  // Unique products for filter select
  const uniqueProducts = Array.from(
    new Set(contacts.map((c) => c.product).filter(Boolean)),
  ) as string[];

  // Selected media object
  const currentMedia = mediaList.find((m) => m.id === selectedMediaId);
  const activeImageUrl = currentMedia?.public_url || imageUrl || null;

  // Sample contact for live preview
  const sampleContact: ContactRow = targetedContacts[0] || {
    id: "sample",
    name: "Jane Smith",
    phone: "+1234567890",
    email: "jane@example.com",
    city: "New York",
    state: "NY",
    company: "Acme Corp",
    product: "Premium Plan",
    status: "ACTIVE",
    created_at: "",
    created_by: null,
    custom_fields: {},
    updated_at: "",
  };

  const previewText = renderTemplate(message, {
    name: sampleContact.name,
    phone: sampleContact.phone,
    email: sampleContact.email,
    city: sampleContact.city,
    state: sampleContact.state,
    company: sampleContact.company,
    product: sampleContact.product,
  });

  const saveMutation = useMutation({
    mutationFn: async (status: "DRAFT" | "READY") => {
      if (!name.trim()) throw new Error("Campaign name is required");
      if (!message.trim()) throw new Error("Message text is required");
      if (targetedContacts.length === 0) throw new Error("No contacts match recipient filters");

      const { data: user } = await supabase.auth.getUser();

      // Insert campaign
      const { data: campaign, error: campError } = await supabase
        .from("campaigns")
        .insert({
          name,
          message,
          media_id: selectedMediaId || null,
          image_url: activeImageUrl,
          status,
          total_recipients: targetedContacts.length,
          recipient_filters: { status: targetStatus, product: targetProduct },
          created_by: user.user?.id ?? null,
        })
        .select()
        .single();

      if (campError) throw campError;

      // Insert campaign recipients
      const recipientInserts = targetedContacts.map((contact) => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        status: "PENDING" as const,
        rendered_message: renderTemplate(message, {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          city: contact.city,
          state: contact.state,
          company: contact.company,
          product: contact.product,
        }),
      }));

      const { error: recError } = await supabase
        .from("campaign_recipients")
        .insert(recipientInserts);
      if (recError) throw recError;

      // Insert activity log
      await supabase.from("activity_logs").insert({
        action: "campaign.created",
        entity_type: "campaigns",
        entity_id: campaign.id,
        user_id: user.user?.id ?? null,
        details: { name: campaign.name, recipients: targetedContacts.length, status },
      });

      return campaign;
    },
    onSuccess: (campaign) => {
      toast.success("Campaign created successfully!");
      queryClient.invalidateQueries({ queryKey: ["campaigns-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-campaigns"] });
      navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create campaign"),
  });

  const insertVariable = (varName: string) => {
    setMessage((prev) => `${prev} {{${varName}}}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create WhatsApp Campaign"
        description="Compose personalized broadcast templates, attach headers, and target audience segments."
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/campaigns" })}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Campaigns
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Form Config */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Give your campaign a title and select media asset.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Campaign Name *</Label>
                <Input
                  id="camp-name"
                  placeholder="e.g. Summer Promo — Premium Members"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="media-select">Media Asset Header (Optional)</Label>
                <Select
                  value={selectedMediaId}
                  onValueChange={(val) => {
                    setSelectedMediaId(val);
                    if (val) setImageUrl("");
                  }}
                >
                  <SelectTrigger id="media-select">
                    <SelectValue placeholder="Select image from Media Library..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No image header</SelectItem>
                    {mediaList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Template Editor */}
          <Card>
            <CardHeader>
              <CardTitle>Message Template</CardTitle>
              <CardDescription>
                Use variable tokens like <code className="rounded bg-muted px-1">{"{{name}}"}</code>{" "}
                to personalize broadcast for each recipient.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Variables:</span>
                {SUPPORTED_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-mono font-medium hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  >
                    + {`{{${v}}}`}
                  </button>
                ))}
              </div>

              <Textarea
                rows={5}
                placeholder="Type your WhatsApp message template here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Recipient Targeting */}
          <Card>
            <CardHeader>
              <CardTitle>Audience Segment</CardTitle>
              <CardDescription>
                Targeting {targetedContacts.length} contacts out of {contacts.length} total.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Status</Label>
                <Select value={targetStatus} onValueChange={setTargetStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">ACTIVE Contacts</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE Contacts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Product Filter</Label>
                <Select value={targetProduct} onValueChange={setTargetProduct}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Products</SelectItem>
                    {uniqueProducts.map((prod) => (
                      <SelectItem key={prod} value={prod}>
                        {prod}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate("DRAFT")}
            >
              Save as Draft
            </Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate("READY")}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Save & Mark Ready
            </Button>
          </div>
        </div>

        {/* Right Col: Phone UI Preview */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-600" /> WhatsApp Live Preview
              </CardTitle>
              <CardDescription className="text-xs">
                Rendering for: <strong>{sampleContact.name}</strong> ({sampleContact.phone})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* WhatsApp Phone Mockup */}
              <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border-4 border-slate-800 bg-[#efeae2] shadow-xl dark:bg-slate-900">
                {/* Chat Topbar */}
                <div className="flex items-center gap-2.5 bg-[#075e54] p-3 text-white">
                  <div className="grid size-7 place-items-center rounded-full bg-emerald-700 text-xs font-bold">
                    CM
                  </div>
                  <div className="leading-tight">
                    <p className="text-xs font-bold">WhatsApp Broadcast</p>
                    <p className="text-[10px] opacity-80">Official Channel</p>
                  </div>
                </div>

                {/* Chat Bubble */}
                <div className="p-3">
                  <div className="relative rounded-lg bg-white p-2.5 text-xs text-slate-800 shadow dark:bg-slate-800 dark:text-slate-100">
                    {activeImageUrl ? (
                      <img
                        src={activeImageUrl}
                        alt="Header"
                        className="mb-2 max-h-36 w-full rounded object-cover"
                      />
                    ) : null}
                    <p className="whitespace-pre-wrap">{previewText}</p>
                    <div className="mt-1 text-right text-[10px] text-muted-foreground">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
