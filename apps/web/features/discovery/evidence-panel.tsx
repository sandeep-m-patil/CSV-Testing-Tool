"use client";

import { useState } from "react";
import { Camera, Copy, Download, ExternalLink, Grid2x2, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate } from "@/lib/utils";

export type DiscoveryArtifact = {
  id: string;
  artifactType: string;
  url: string | null;
  label: string;
  createdAt: string;
};

type DiscoveredPage = {
  id: string;
  name: string;
  url: string;
  title: string;
  pageType: string;
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];

export function EvidencePanel({
  artifacts,
  pages,
}: {
  artifacts: DiscoveryArtifact[];
  pages: DiscoveredPage[];
}) {
  const [gridSize, setGridSize] = useState<"sm" | "lg">("sm");
  const [preview, setPreview] = useState<DiscoveryArtifact | null>(null);

  const gridClass = gridSize === "sm" ? "sm:grid-cols-2" : "lg:grid-cols-3";

  return (
    <Tabs defaultValue="evidence">
      <div className="mb-3 flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{artifacts.length} screenshots</span>
          {artifacts.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              title={gridSize === "sm" ? "Larger thumbnails" : "Smaller thumbnails"}
              aria-label="Toggle thumbnail size"
              onClick={() => setGridSize((current) => (current === "sm" ? "lg" : "sm"))}
            >
              <Grid2x2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <TabsContent value="evidence" className="mt-0">
        {artifacts.length === 0 && <EmptyState>No screenshot evidence captured yet.</EmptyState>}
        <div className={`grid max-h-[480px] gap-3 overflow-auto pr-1 ${gridClass}`}>
          {artifacts.map((artifact) => (
            <EvidenceCard key={artifact.id} artifact={artifact} onOpen={() => setPreview(artifact)} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="pages" className="mt-0">
        {pages.length === 0 && <EmptyState>No pages discovered yet.</EmptyState>}
        <div className="overflow-hidden rounded-lg border">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={`p-3 ${index % 2 === 0 ? "bg-muted/10" : ""} ${index !== pages.length - 1 ? "border-b" : ""}`}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{page.name}</p>
                <Badge variant="muted">{page.pageType}</Badge>
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">{page.url}</p>
              {page.title && <p className="truncate text-xs text-muted-foreground">{page.title}</p>}
            </div>
          ))}
        </div>
      </TabsContent>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-5xl gap-3">
          <DialogHeader>
            <DialogTitle className="pr-8 text-sm">{preview?.label}</DialogTitle>
            <DialogDescription className="text-xs">
              {preview ? `${formatDate(preview.createdAt)} · ${preview.artifactType}` : null}
            </DialogDescription>
          </DialogHeader>
          {preview?.url && <ScreenshotViewer url={preview.url} alt={preview.label} />}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function evidenceFilename(label: string): string {
  return `${label.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")}.png`;
}

function EvidenceLink({
  url,
  download,
  title,
  children,
}: {
  url: string;
  download?: string;
  title: string;
  children: React.ReactNode;
}) {
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

function EvidenceCard({ artifact, onOpen }: { artifact: DiscoveryArtifact; onOpen: () => void }) {
  return (
    <figure className="overflow-hidden rounded-lg border bg-card">
      {artifact.url ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-zoom-in"
          aria-label={`Preview ${artifact.label}`}
        >
          <img
            src={artifact.url}
            alt={artifact.label}
            className="h-44 w-full border-b object-top"
            data-testid="evidence-image"
          />
        </button>
      ) : (
        <div className="flex h-44 items-center justify-center bg-muted/20 text-xs text-muted-foreground">
          <Camera className="mr-1 h-4 w-4" />
          preview unavailable
        </div>
      )}
      <figcaption className="flex items-start justify-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{artifact.label}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(artifact.createdAt)}</p>
        </div>
        {artifact.url && (
          <div className="flex shrink-0 items-center gap-1">
            <EvidenceLink url={artifact.url} title="Open full size">
              <ExternalLink className="h-3.5 w-3.5" />
            </EvidenceLink>
            <EvidenceLink url={artifact.url} download={evidenceFilename(artifact.label)} title="Download PNG">
              <Download className="h-3.5 w-3.5" />
            </EvidenceLink>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function ScreenshotViewer({ url, alt }: { url: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [copied, setCopied] = useState(false);

  const zoomIn = () => setZoom((current) => ZOOM_STEPS.find((step) => step > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!);
  const zoomOut = () => setZoom((current) => [...ZOOM_STEPS].reverse().find((step) => step < current) ?? ZOOM_STEPS[0]!);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

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
          <Button variant="outline" size="sm" onClick={() => setFitWidth((current) => !current)}>
            {fitWidth ? "Actual size" : "Fit width"}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => void copyUrl()}>
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy URL"}
          </Button>
          <EvidenceLink url={url} title="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </EvidenceLink>
          <EvidenceLink url={url} download={evidenceFilename(alt)} title="Download PNG">
            <Download className="h-4 w-4" />
          </EvidenceLink>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted p-2">
        <img
          src={url}
          alt={alt}
          className={fitWidth ? "w-full" : "mx-auto"}
          style={fitWidth ? undefined : { width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {children}
    </div>
  );
}
