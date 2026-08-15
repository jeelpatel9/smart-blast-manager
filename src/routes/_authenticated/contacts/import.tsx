import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, FileSpreadsheet, Loader2, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
        content: "Bulk import contacts via Excel or CSV spreadsheet into WhatsApp manager.",
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
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        if (jsonRows.length === 0) {
          toast.error("The selected file contains no data rows");
          return;
        }

        const rows: ParsedContact[] = jsonRows.map((row) => {
          const keys = Object.keys(row);
          const getKeyVal = (terms: string[]) => {
            const matchedKey = keys.find((k) =>
              terms.some((t) =>
                k
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "")
                  .includes(t),
              ),
            );
            return matchedKey ? String(row[matchedKey]).trim() : "";
          };

          const name =
            getKeyVal(["name", "customer", "contact"]) || String(row[keys[0]] || "").trim();
          const rawPhone =
            getKeyVal(["phone", "mobile", "number", "whatsapp"]) ||
            String(row[keys[1]] || "").trim();
          const email = getKeyVal(["email", "mail"]);
          const city = getKeyVal(["city", "town"]);
          const state = getKeyVal(["state", "region", "province"]);
          const company = getKeyVal(["company", "org", "business"]);
          const product = getKeyVal(["product", "service", "plan", "item"]);

          const cleanPhone = rawPhone.replace(/[^0-9+]/g, "");
          const isValid = !!name && cleanPhone.length >= 7;

          return {
            name,
            phone: cleanPhone || rawPhone,
            email: email || undefined,
            city: city || undefined,
            state: state || undefined,
            company: company || undefined,
            product: product || undefined,
            isValid,
            error: !name
              ? "Missing name"
              : cleanPhone.length < 7
                ? "Invalid phone format"
                : undefined,
          };
        });

        setParsedRows(rows);
      } catch (err: unknown) {
        toast.error("Failed to parse spreadsheet file");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
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
        created_by: user.user?.id ?? null,
      }));

      const { data, error } = await supabase.from("contacts").insert(inserts).select();
      if (error) throw error;

      await supabase.from("activity_logs").insert({
        action: "contacts.imported",
        entity_type: "contacts",
        user_id: user.user?.id ?? null,
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
              {fileName ? fileName : "Click or drag Excel or CSV file to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports .xlsx, .xls, and .csv formats. Phone column is required for WhatsApp
              broadcasts.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <Upload className="mr-2 size-4" />
              Choose File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
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
