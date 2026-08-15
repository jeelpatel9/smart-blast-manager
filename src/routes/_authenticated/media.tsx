import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type MediaRow = Database["public"]["Tables"]["media"]["Row"];

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "Media Library — WhatsApp Campaign Manager" },
      { name: "description", content: "Upload and manage promotional image assets for WhatsApp broadcasts." },
    ],
  }),
  component: MediaLibraryPage,
});

function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<MediaRow | null>(null);

  const { data: mediaItems = [], isLoading } = useQuery({
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WEBP)");
      return;
    }

    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload file to campaign-media bucket
      const { error: uploadError } = await supabase.storage
        .from("campaign-media")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("campaign-media").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // Insert row in media table
      const { data: mediaRecord, error: dbError } = await supabase
        .from("media")
        .insert({
          file_name: file.name,
          storage_path: filePath,
          public_url: publicUrl,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: user.user?.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      await supabase.from("activity_logs").insert({
        action: "media.uploaded",
        entity_type: "media",
        entity_id: mediaRecord.id,
        user_id: user.user?.id,
        details: { file_name: file.name, size: file.size },
      });

      toast.success("Image uploaded successfully!");
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingMedia) return;
      // Delete storage file
      await supabase.storage.from("campaign-media").remove([deletingMedia.storage_path]);

      // Delete database record
      const { error } = await supabase.from("media").delete().eq("id", deletingMedia.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Media deleted");
      queryClient.invalidateQueries({ queryKey: ["media-items"] });
      setDeletingMedia(null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete media"),
  });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Image URL copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description="Upload images to include as headers in your WhatsApp broadcast messages."
        actions={
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90">
            {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
        }
      />

      {/* Upload Banner / Dropzone */}
      <Card>
        <CardContent className="pt-6">
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-8 text-center transition-colors hover:border-primary/50 cursor-pointer">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <ImageIcon className="size-6" />
            </div>
            <p className="mt-3 text-sm font-semibold">Click or drag image to upload to media library</p>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
        </CardContent>
      </Card>

      {/* Media Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No media files uploaded yet. Click "Upload Image" to add broadcast header assets.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mediaItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {item.public_url ? (
                  <img
                    src={item.public_url}
                    alt={item.file_name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <ImageIcon className="size-8" />
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <p className="truncate font-semibold text-xs text-foreground" title={item.file_name}>
                  {item.file_name}
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{item.size_bytes ? `${Math.round(item.size_bytes / 1024)} KB` : "Image"}</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => item.public_url && copyUrl(item.public_url)}
                  >
                    <Copy className="mr-1 size-3.5" /> Copy URL
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => setDeletingMedia(item)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingMedia} onOpenChange={(open) => !open && setDeletingMedia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media File?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingMedia?.file_name}</strong>?
              Campaigns using this image header will no longer display it.
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
