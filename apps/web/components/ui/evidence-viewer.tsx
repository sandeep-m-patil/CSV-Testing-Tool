"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Minus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Screenshot gallery dialog used wherever evidence is shown: discovery, test
 * runs and reports. Previous/Next buttons and the arrow keys move through the
 * list the dialog was opened from; zoom, copy, open and download act on the
 * current image.
 */

export interface EvidenceItem {
  url: string;
  title: string;
  subtitle?: string;
}

interface EvidenceViewerProps {
  items: EvidenceItem[];
  /** Index of the open image; null keeps the dialog closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];

export function evidenceFilename(label: string): string {
  return `${label.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "evidence"}.png`;
}

export function EvidenceViewer({ items, index, onIndexChange }: EvidenceViewerProps) {
  const item = index === null ? undefined : items[index];
  const hasPrevious = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;
  const go = (delta: number) => index !== null && onIndexChange(Math.min(Math.max(index + delta, 0), items.length - 1));

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open={item !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="max-w-5xl gap-3">
        <DialogHeader>
          <DialogTitle className="pr-8 text-sm">{item?.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {item?.subtitle ? `${item.subtitle} · ` : ""}
            {index !== null ? `${index + 1} of ${items.length}` : ""}
          </DialogDescription>
        </DialogHeader>
        {item && (
          <>
            <ViewerToolbar key={`toolbar-${index}`} item={item} />
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={!hasPrevious} aria-label="Previous screenshot">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">← / → to navigate</span>
              <Button variant="outline" size="sm" onClick={() => go(1)} disabled={!hasNext} aria-label="Next screenshot">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Zoom, fit, copy, open and download for one image; remounted per image so zoom resets. */
function ViewerToolbar({ item }: { item: EvidenceItem }) {
  const [zoom, setZoom] = useState(1);
  const [isFitWidth, setIsFitWidth] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const zoomIn = () => setZoom((current) => ZOOM_STEPS.find((step) => step > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!);
  const zoomOut = () => setZoom((current) => [...ZOOM_STEPS].reverse().find((step) => step < current) ?? ZOOM_STEPS[0]!);
  const absoluteUrl = () => new URL(item.url, window.location.origin).toString();

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(absoluteUrl());
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center font-mono text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFitWidth((current) => !current)}>
            {isFitWidth ? "Actual size" : "Fit width"}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => void copyUrl()}>
            <Copy className="h-3.5 w-3.5" />
            {isCopied ? "Copied" : "Copy URL"}
          </Button>
          <ViewerLink url={item.url} title="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ViewerLink>
          <ViewerLink url={item.url} download={evidenceFilename(item.title)} title="Download PNG">
            <Download className="h-4 w-4" />
          </ViewerLink>
        </div>
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-lg border bg-background p-2">
        <img src={item.url} alt={item.title} className={isFitWidth ? "w-full" : "mx-auto"} style={isFitWidth ? undefined : { width: `${zoom * 100}%` }} />
      </div>
    </div>
  );
}

export function ViewerLink({ url, download, title, children }: { url: string; download?: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={url}
      title={title}
      aria-label={title}
      {...(download ? { download } : { target: "_blank", rel: "noreferrer" })}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7 [&_svg]:size-3.5")}
    >
      {children}
    </a>
  );
}
