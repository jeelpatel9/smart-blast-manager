import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Check, Key, Loader2, Save, Shield, User } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WhatsApp Campaign Manager" },
      { name: "description", content: "System configuration, WhatsApp webhook options, and administrator roles." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();

  const [whatsappApiKey, setWhatsappApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [defaultCountryCode, setDefaultCountryCode] = useState("+1");
  const [maxBatchRate, setMaxBatchRate] = useState("50");

  const { data: settingsList = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: currentUserProfile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.user.id)
        .single();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.user.id);
      return { profile, roles, email: user.user.email };
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (settingsList.length > 0) {
      settingsList.forEach((setting) => {
        if (setting.key === "whatsapp_api_key") setWhatsappApiKey(String(setting.value || ""));
        if (setting.key === "webhook_secret") setWebhookSecret(String(setting.value || ""));
        if (setting.key === "default_country_code") setDefaultCountryCode(String(setting.value || "+1"));
        if (setting.key === "max_batch_rate") setMaxBatchRate(String(setting.value || "50"));
      });
    }
  }, [settingsList]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const items = [
        { key: "whatsapp_api_key", value: whatsappApiKey },
        { key: "webhook_secret", value: webhookSecret },
        { key: "default_country_code", value: defaultCountryCode },
        { key: "max_batch_rate", value: maxBatchRate },
      ];

      for (const item of items) {
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: item.key, value: item.value as any }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save settings"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Manage WhatsApp API connections, batch dispatch rates, and administrator accounts."
      />

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="size-4" /> API & Webhooks
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Shield className="size-4" /> Admin Accounts & Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Gateway Configuration</CardTitle>
              <CardDescription>
                Configure credentials and limits for sending broadcast messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">WhatsApp Provider API Key / Token</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={whatsappApiKey}
                  onChange={(e) => setWhatsappApiKey(e.target.value)}
                  placeholder="e.g. EAAG..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-sec">Webhook Verification Secret</Label>
                <Input
                  id="webhook-sec"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="e.g. whsec_..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country-code">Default Country Code</Label>
                  <Input
                    id="country-code"
                    value={defaultCountryCode}
                    onChange={(e) => setDefaultCountryCode(e.target.value)}
                    placeholder="+1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch-rate">Max Blast Batch Rate (msg/sec)</Label>
                  <Input
                    id="batch-rate"
                    type="number"
                    value={maxBatchRate}
                    onChange={(e) => setMaxBatchRate(e.target.value)}
                  />
                </div>
              </div>

              <Button
                disabled={saveSettingsMutation.isPending}
                onClick={() => saveSettingsMutation.mutate()}
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Administrator Profile</CardTitle>
              <CardDescription>Authenticated user details and current system role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary font-bold">
                  <User className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {currentUserProfile?.profile?.full_name || "Admin User"}
                  </p>
                  <p className="text-xs text-muted-foreground">{currentUserProfile?.email}</p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  Role: {currentUserProfile?.roles?.[0]?.role || "admin"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered System Users</CardTitle>
              <CardDescription>Profiles in the system database.</CardDescription>
            </CardHeader>
            <CardContent>
              {allProfiles.length === 0 ? (
                <div className="py-4 text-xs text-muted-foreground">No profiles loaded.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.full_name || "—"}</TableCell>
                        <TableCell className="text-xs">{p.email || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(p.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
