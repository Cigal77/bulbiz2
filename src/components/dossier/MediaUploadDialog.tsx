import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Upload, X, Loader2, Image, Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => Promise<void>;
  mode: "photo_video" | "plan";
}

const ACCEPT_MAP = {
  photo_video: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime",
  plan: "image/jpeg,image/png,application/pdf",
};

const LABEL_MAP = {
  photo_video: "Photo / Vidéo",
  plan: "Plan",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PLAN_SIZE = 20 * 1024 * 1024;  // 20 MB

function getMaxSize(file: File, mode: string) {
  if (mode === "plan") return MAX_PLAN_SIZE;
  if (file.type.startsWith("video/")) return MAX_VIDEO_SIZE;
  return MAX_IMAGE_SIZE;
}

export function MediaUploadDialog({ open, onClose, onUpload, mode }: MediaUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid: File[] = [];
    for (const f of arr) {
      const max = getMaxSize(f, mode);
      if (f.size > max) {
        setError(`${f.name} dépasse la taille max (${Math.round(max / 1024 / 1024)} MB)`);
        return;
      }
      valid.push(f);
    }
    setError(null);
    setFiles((prev) => [...prev, ...valid]);
    setPreviews((prev) => [
      ...prev,
      ...valid.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : "")),
    ]);
  }, [mode]);

  const removeFile = (idx: number) => {
    if (previews[idx]) URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUpload(files);
      cleanup();
      onClose();
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const cleanup = () => {
    previews.forEach((p) => p && URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setError(null);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{LABEL_MAP[mode]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            )}
            onClick={() => inputRef.current?.click()}
          >
            {mode === "photo_video" ? (
              <Camera className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground text-center">
              {mode === "photo_video"
                ? "Glissez ou cliquez pour ajouter des photos/vidéos"
                : "Glissez ou cliquez pour ajouter un plan (PDF ou image)"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_MAP[mode]}
              multiple={mode === "photo_video"}
              capture={mode === "photo_video" ? "environment" : undefined}
              onChange={(e) => e.target.files && addFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-border">
                  {previews[i] ? (
                    <img src={previews[i]} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                      {f.type.startsWith("video/") ? (
                        <Film className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground text-center truncate w-full">{f.name}</span>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || files.length === 0} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Upload…" : `Enregistrer (${files.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
