"use client";

import { useState } from "react";
import { Camera, Download, ExternalLink, Grid2x2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvidenceViewer, ViewerLink, evidenceFilename, type EvidenceItem } from "@/components/ui/evidence-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";

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

export function EvidencePanel({
  artifacts,
  pages,
}: {
  artifacts: DiscoveryArtifact[];
  pages: DiscoveredPage[];
}) {
  const [gridSize, setGridSize] = useState<"sm" | "lg">("sm");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // Only artifacts with an image take part in Previous/Next.
  const viewable = artifacts.filter((artifact) => artifact.url);
  const items: EvidenceItem[] = viewable.map((artifact) => ({
    url: artifact.url!,
    title: artifact.label,
    subtitle: `${formatDate(artifact.createdAt)} · ${artifact.artifactType}`,
  }));

  const gridClass = gridSize === "sm" ? "sm:grid-cols-2" : "lg:grid-cols-3";

  return (
    <Tabs defaultValue="evidence">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="evidence">
            Evidence
            <span className="text-xs tabular-nums text-muted-foreground">{artifacts.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pages">
            Pages
            <span className="text-xs tabular-nums text-muted-foreground">{pages.length}</span>
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{artifacts.length} screenshots</span>
          {artifacts.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
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
            <EvidenceCard key={artifact.id} artifact={artifact} onOpen={() => setPreviewIndex(viewable.indexOf(artifact))} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="pages" className="mt-0">
        {pages.length === 0 && <EmptyState>No pages discovered yet.</EmptyState>}
        {pages.length > 0 && (
          <ul className="max-h-[480px] divide-y overflow-auto rounded-xl border bg-card">
            {pages.map((page) => (
              <li key={page.id} className="space-y-0.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{page.name}</p>
                  <Badge variant="muted">{page.pageType}</Badge>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{page.url}</p>
                {page.title && <p className="truncate text-xs text-muted-foreground">{page.title}</p>}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <EvidenceViewer items={items} index={previewIndex} onIndexChange={setPreviewIndex} />
    </Tabs>
  );
}

function EvidenceCard({ artifact, onOpen }: { artifact: DiscoveryArtifact; onOpen: () => void }) {
  return (
    <figure className="group overflow-hidden rounded-xl border bg-card transition-colors hover:border-muted-foreground/30">
      {artifact.url ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Preview ${artifact.label}`}
        >
          <img
            src={artifact.url}
            alt={artifact.label}
            className="h-44 w-full border-b bg-muted/40 object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
            data-testid="evidence-image"
          />
        </button>
      ) : (
        <div className="flex h-44 items-center justify-center border-b bg-muted/30 text-xs text-muted-foreground">
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
            <ViewerLink url={artifact.url} title="Open full size">
              <ExternalLink className="h-3.5 w-3.5" />
            </ViewerLink>
            <ViewerLink url={artifact.url} download={evidenceFilename(artifact.label)} title="Download PNG">
              <Download className="h-3.5 w-3.5" />
            </ViewerLink>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 text-sm text-muted-foreground">
      <Camera className="h-5 w-5" aria-hidden="true" />
      {children}
    </div>
  );
}
