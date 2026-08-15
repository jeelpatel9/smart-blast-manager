import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Copy, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
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

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — WhatsApp Campaign Manager" },
      { name: "description", content: "Generate optimized WhatsApp campaign text templates with AI assistance." },
    ],
  }),
  component: AIAssistantPage,
});

const TEMPLATE_PRESETS = [
  {
    id: "promo",
    label: "Promotional Offer",
    desc: "Drive sales with limited-time discounts or flash deals.",
    text: "Hi {{name}}! 🔥 Exclusive offer for you: Get 20% off on {{product}} at {{company}}! Use code FLASH20 today. Click here to claim: https://example.com/deal",
  },
  {
    id: "reengage",
    label: "Customer Re-engagement",
    desc: "Win back inactive customers with a friendly check-in.",
    text: "Hey {{name}}! We missed you at {{company}}. We noticed you haven't checked out {{product}} recently. Here's a special perk just for you! Reply YES to unlock your gift 🎁",
  },
  {
    id: "order",
    label: "Order / Booking Confirmation",
    desc: "Send instant updates regarding products or services.",
    text: "Hello {{name}}, your request for {{product}} at {{company}} has been confirmed! 🚀 We'll reach out to your phone {{phone}} shorty. Thank you for choosing us!",
  },
  {
    id: "event",
    label: "Event Invitation",
    desc: "Invite contacts to webinars, launches, or demos.",
    text: "Hi {{name}}! You're invited to our exclusive {{product}} showcase event in {{city}}. Join leaders from {{company}} this Friday. Reserve your free spot now!",
  },
  {
    id: "feedback",
    label: "Feedback & Review Request",
    desc: "Gather testimonials and ratings after purchase.",
    text: "Hi {{name}}, how is your experience with {{product}}? We'd love your 30-second feedback to serve you better. Tap below to share your thoughts: https://example.com/feedback",
  },
];

function AIAssistantPage() {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState("promo");
  const [productName, setProductName] = useState("VIP Pass");
  const [companyName, setCompanyName] = useState("Smart Blast");
  const [tone, setTone] = useState("friendly");
  const [generatedCopy, setGeneratedCopy] = useState(TEMPLATE_PRESETS[0].text);

  function handleGenerate() {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === selectedPreset) || TEMPLATE_PRESETS[0];
    let text = preset.text;
    if (productName) text = text.replace(/\{\{product\}\}/g, productName);
    if (companyName) text = text.replace(/\{\{company\}\}/g, companyName);

    if (tone === "urgent") {
      text = "⚡ URGENT UPDATE FOR {{name}} ⚡\n\n" + text + "\n\n⏰ Offer expires in 2 hours!";
    } else if (tone === "festive") {
      text = "🎉 Celebrating with {{name}}! 🎉\n\n" + text + "\n\n✨ Wishing you great success!";
    }

    setGeneratedCopy(text);
    toast.success("AI WhatsApp template generated!");
  }

  function handleCopy() {
    navigator.clipboard.writeText(generatedCopy);
    toast.success("Copied message to clipboard!");
  }

  function handleUseInCampaign() {
    navigate({
      to: "/campaigns/new",
      search: { template: generatedCopy },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Copy Assistant"
        description="Select campaign goals to generate engaging, high-conversion WhatsApp templates."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Generator Controls */}
        <div className="space-y-6 lg:col-span-2">
          {/* Preset Selector */}
          <Card>
            <CardHeader>
              <CardTitle>1. Select Broadcast Goal</CardTitle>
              <CardDescription>Choose a pre-tested WhatsApp copy strategy.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(p.id);
                      setGeneratedCopy(p.text);
                    }}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedPreset === p.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <p className="font-semibold text-sm">{p.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Form Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>2. Customize Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product / Offer Name</Label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. VIP Subscription"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand / Company</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Smart Blast"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Brand Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly & Conversational</SelectItem>
                    <SelectItem value="urgent">Urgent & High FOMO</SelectItem>
                    <SelectItem value="festive">Festive & Celebratory</SelectItem>
                    <SelectItem value="professional">Formal & Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                <Wand2 className="mr-2 size-4" />
                Generate AI Copy Template
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Output Preview */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-600" /> Generated Template Output
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={generatedCopy}
                onChange={(e) => setGeneratedCopy(e.target.value)}
                className="font-sans text-xs leading-relaxed"
              />

              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  <Copy className="mr-2 size-4" /> Copy Text
                </Button>
                <Button className="w-full" onClick={handleUseInCampaign}>
                  Use in New Campaign <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
