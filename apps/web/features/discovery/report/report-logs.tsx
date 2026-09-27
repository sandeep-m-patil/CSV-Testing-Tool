"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type ReportLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

const NOISY_PATTERN = /Call log:|strict mode violation|Timeout .*exceeded|locator\.(click|fill|check|selectOption)/;
const MAX_LEVELS = 6;

function isNoise(log: ReportLog): boolean {
  return (log.level === "error" || log.level === "warn") && NOISY_PATTERN.test(log.message);
}

/**
 * Print-friendly log list: no scroll container, full messages, and low-level
 * Playwright noise collapsed behind a toggle so the printed page stays readable.
 */
export function ReportLogs({ logs }: { logs: ReportLog[] }) {
  const [showNoise, setShowNoise] = useState(false);
  const visible = showNoise ? logs : logs.filter((log) => !isNoise(log));
  const hidden = logs.length - visible.length;

  return (
    <Card className="print-card">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          Discovery log ({visible.length} of {logs.length} entries)
        </CardTitle>
        {hidden > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="no-print h-7 text-xs"
            onClick={() => setShowNoise((current) => !current)}
          >
            {showNoise ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
            {showNoise ? "Hide" : "Show"} {hidden} low-level {hidden === 1 ? "entry" : "entries"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? <p className="text-sm text-muted-foreground">No log entries.</p> : null}
        <ol className="space-y-1 font-mono text-[11px] leading-relaxed">
          {visible.map((log) => (
            <li key={log.id} className="print-block flex gap-2 border-b border-dashed py-0.5 last:border-0">
              <span className="w-6 shrink-0 text-right font-semibold" style={{ color: levelColor(log.level) }}>
                {log.level.slice(0, 4).toUpperCase()}
              </span>
              <span className="w-40 shrink-0 text-muted-foreground">{formatDate(log.createdAt)}</span>
              <span className="whitespace-pre-wrap break-words">{log.message}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function levelColor(level: string): string {
  if (level === "error") return "#b91c1c";
  if (level === "warn") return "#b45309";
  if (level === "event" || level === "info") return "#1d4ed8";
  if (level === "action") return "#047857";
  if (level === "success") return "#047857";
  return "#475569";
}
