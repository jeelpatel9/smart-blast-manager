export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "READY",
  "APPROVED",
  "SENDING",
  "COMPLETED",
  "PARTIALLY_FAILED",
  "FAILED",
  "CANCELLED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const MESSAGE_STATUSES = ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const CONTACT_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

export const campaignStatusTone: Record<CampaignStatus, Tone> = {
  DRAFT: "neutral",
  READY: "info",
  APPROVED: "primary",
  SENDING: "warning",
  COMPLETED: "success",
  PARTIALLY_FAILED: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export const messageStatusTone: Record<MessageStatus, Tone> = {
  PENDING: "neutral",
  SENT: "info",
  DELIVERED: "primary",
  READ: "success",
  FAILED: "danger",
};

export const contactStatusTone: Record<ContactStatus, Tone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  BLOCKED: "danger",
};

export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type TemplateVars = Record<string, string | null | undefined>;

/** Replaces {{variable}} tokens with contact values. Unknown vars stay visible. */
export function renderTemplate(template: string, vars: TemplateVars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = vars[key];
    return value ? String(value) : match;
  });
}

export function templateVariables(template: string) {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export const SUPPORTED_VARIABLES = [
  "name",
  "phone",
  "email",
  "city",
  "state",
  "company",
  "product",
] as const;
