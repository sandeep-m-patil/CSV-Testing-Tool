"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceViewer } from "@/components/ui/evidence-viewer";
import { formatDate } from "@/lib/utils";

export type ReportShot = {
  id: string;
  url: string | null;
  label: string;
  createdAt: string;
  kind: "page" | "action";
};

/**
 * Screenshot grid sized for A4 printing — two per row with a caption under
 * each image. On screen, clicking a shot opens the gallery viewer.
 */
export function ReportGallery({ shots }: { shots: ReportShot[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const viewable = shots.filter((shot) => shot.url);
  const items = viewable.map((shot) => ({ url: shot.url!, title: shot.label, subtitle: `${shot.kind} · ${formatDate(shot.createdAt)}` }));
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evidence ({shots.length} screenshots)</CardTitle>
      </CardHeader>
      <CardContent>
        {shots.length === 0 ? <p className="text-sm text-muted-foreground">No screenshots captured.</p> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shots.map((shot) => (
            <figure key={shot.id} className="print-block overflow-hidden rounded-lg border bg-card">
              {shot.url ? (
                <button type="button" className="block w-full cursor-zoom-in" onClick={() => setIndex(viewable.indexOf(shot))} aria-label={`Open ${shot.label}`}>
                  <img src={shot.url} alt={shot.label} className="h-56 w-full border-b bg-muted/40 object-cover object-top" />
                </button>
              ) : (
                <div className="flex h-56 items-center justify-center border-b bg-muted/20 text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
              <figcaption className="space-y-0.5 p-3 text-xs">
                <p className="font-medium">{shot.label}</p>
                <p className="text-muted-foreground">
                  {shot.kind} &middot; {formatDate(shot.createdAt)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </CardContent>
      <EvidenceViewer items={items} index={index} onIndexChange={setIndex} />
    </Card>
  );
}
