"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export type ReportShot = {
  id: string;
  url: string | null;
  label: string;
  createdAt: string;
  kind: "page" | "action";
};

/**
 * Static screenshot grid sized for A4 printing — two per row, no hover
 * overlays or dialogs, and a caption under each image.
 */
export function ReportGallery({ shots }: { shots: ReportShot[] }) {
  return (
    <Card className="print-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evidence ({shots.length} screenshots)</CardTitle>
      </CardHeader>
      <CardContent>
        {shots.length === 0 ? <p className="text-sm text-muted-foreground">No screenshots captured.</p> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {shots.map((shot) => (
            <figure key={shot.id} className="print-block overflow-hidden rounded-md border">
              {shot.url ? (
                <img src={shot.url} alt={shot.label} className="h-56 w-full border-b bg-card object-top" />
              ) : (
                <div className="flex h-56 items-center justify-center border-b bg-muted/20 text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
              <figcaption className="space-y-0.5 p-2 text-xs">
                <p className="font-medium">{shot.label}</p>
                <p className="text-muted-foreground">
                  {shot.kind} &middot; {formatDate(shot.createdAt)}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
