import type { Media } from "@/hooks/useDossier";
import { Image, Film, FileText } from "lucide-react";

interface MediaGalleryProps {
  medias: Media[];
  isLoading: boolean;
}

export function MediaGallery({ medias, isLoading }: MediaGalleryProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Médias</h3>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Médias {medias.length > 0 && <span className="text-foreground">({medias.length})</span>}
      </h3>
      {medias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun média attaché.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {medias.map((media) => {
            const isImage = media.file_type.startsWith("image/");
            const isVideo = media.file_type.startsWith("video/");
            return (
              <a
                key={media.id}
                href={media.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border hover:border-primary/30 transition-all"
              >
                {isImage ? (
                  <img
                    src={media.file_url}
                    alt={media.file_name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                    {isVideo ? (
                      <Film className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground text-center truncate w-full">
                      {media.file_name}
                    </span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
