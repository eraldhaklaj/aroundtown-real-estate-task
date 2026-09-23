import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const photos = images.length > 0 ? images : [""];
  const go = (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length);

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
        <ImageWithFallback src={photos[index]} alt={`${title}, photo ${index + 1}`} className="size-full object-cover" loading="eager" />
        {photos.length > 1 && (
          <>
            <Button size="icon" variant="secondary" className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full opacity-90" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeftIcon />
            </Button>
            <Button size="icon" variant="secondary" className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full opacity-90" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRightIcon />
            </Button>
            <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-opacity",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <ImageWithFallback src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
