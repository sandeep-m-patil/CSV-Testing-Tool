"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export interface LightboxImage {
  url: string;
  title: string;
}

/** Full-size screenshot viewer; Escape or a click outside closes it. */
export function ScreenshotLightbox({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, onClose]);

  if (!image) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={image.title} onClick={onClose}>
      <div className="mb-3 flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0 truncate font-semibold text-white">{image.title}</div>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto" onClick={(event) => event.stopPropagation()}>
        <img src={image.url} alt={image.title} className="block h-auto w-full rounded border" />
      </div>
    </div>
  );
}
