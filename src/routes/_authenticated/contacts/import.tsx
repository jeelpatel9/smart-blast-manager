import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, FileSpreadsheet, Loader2, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
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

export const Route = createFileRoute("/_authenticated/contacts/import")({
  head: () => ({
    meta: [
      { title: "Import Contacts — WhatsApp Campaign Manager" },
      {
        name: "description",
        content: "Bulk import contacts via CSV spreadsheet into WhatsApp manager.",
      },
    ],
  }),
  component: ContactsImportPage,
});

interface ParsedContact {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  company?: string;
  product?: string;
  isValid: boolean;
  error?: string;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function ContactsImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setFileName(selectedFile.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        toast.error("The selected file is empty");
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const phoneIdx = headers.findIndex(
        (h) => h.includes("phone") || h.includes("mobile") || h.includes("number"),
      );
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const cityIdx = headers.findIndex((h) => h.includes("city"));
      const stateIdx = headers.findIndex((h) => h.includes("state") || h.includes("region"));
      const companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("org"));
      const productIdx = headers.findIndex(
        (h) => h.includes("product") || h.includes("service") || h.includes("plan"),
      );

      const rows: ParsedContact[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length === 0 || cols.every((c) => !c)) continue;

        const name = nameIdx >= 0 ? cols[nameIdx] : cols[0] || "";
        const phone = phoneIdx >= 0 ? cols[phoneIdx] : cols[1] || "";
        const email = emailIdx >= 0 ? cols[emailIdx] : "";
        const city = cityIdx >= 0 ? cols[cityIdx] : "";
        const state = stateIdx >= 0 ? cols[stateIdx] : "";
        const company = companyIdx >= 0 ? cols[companyIdx] : "";
        const product = productIdx >= 0 ? cols[productIdx] : "";

        const cleanPhone = phone.replace(/[^0-9+]/g, "");
        const isValid = !!name && cleanPhone.length >= 7;

        rows.push({
          name,
          phone: cleanPhone || phone,
          email,
          city,
          state,
          company,
          product,
          isValid,
          error: !name
            ? "Missing name"
            : cleanPhone.length < 7
              ? "Invalid phone format"
              : undefined,
        });
      }

      setParsedRows(rows);
    };
    reader.readAsText(selectedFile);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = parsedRows.filter((r) => r.isValid);
      if (validRows.length === 0) throw new Error("No valid rows to import");

      const { data: user } = await supabase.auth.getUser();

      const inserts = validRows.map((r) => ({
        name: r.name,
        phone: r.phone,
        email: r.email || null,
        city: r.city || null,
        state: r.state || null,
        company: r.company || null,
        product: r.product || null,
        status: "ACTIVE" as const,
        created_by: user.user?.id,
      }));

      const { data, error } = await supabase.from("contacts").insert(inserts).select();
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "contacts.imported",
        entity_type: "contacts",
        user_id: user.user?.id,
        details: { count: data.length, filename: fileName },
      });

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.length} contacts!`);
      queryClient.invalidateQueries({ queryKey: ["contacts-list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-contacts-count"] });
      navigate({ to: "/contacts" });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to import contacts"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Contacts (CSV)"
        description="Upload a CSV spreadsheet with customer details to add them to your audience."
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/contacts" })}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Contacts
          </Button>
        }
      />

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Select a CSV file containing columns for Name, Phone, Email, City, State, Company,
            Product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <FileSpreadsheet className="size-6" />
            </div>
            <p className="mt-3 font-semibold">
              {fileName ? fileName : "Click or drag CSV file to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports .csv format. Phone column is required for WhatsApp broadcasts.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <Upload className="mr-2 size-4" />
              Choose File
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Parsed Preview Table */}
      {parsedRows.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Preview Import Data</CardTitle>
              <CardDescription>
                Found {parsedRows.length} rows ({validCount} valid, {parsedRows.length - validCount}{" "}
                invalid)
              </CardDescription>
            </div>
            <Button
              disabled={validCount === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Import {validCount} Valid Contacts
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City/State</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Product</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx} className={row.isValid ? "" : "bg-destructive/5"}>
                      <TableCell>
                        {row.isValid ? (
                          <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                            <Check className="mr-1 size-3.5" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-destructive">
                            <AlertCircle className="mr-1 size-3.5" /> {row.error}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{row.email || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{row.company || "—"}</TableCell>
                      <TableCell className="text-xs">{row.product || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
