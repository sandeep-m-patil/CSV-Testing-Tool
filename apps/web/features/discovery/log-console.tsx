"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DiscoveryLogLine = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

const MAX_INLINE_MESSAGE = 160;

const NOISY_ERROR_PATTERN = /Call log:|strict mode violation|Timeout .*exceeded|locator\.(click|fill|check|selectOption)/;

function isLowLevelNoise(level: string, message: string): boolean {
  if (level !== "error" && level !== "warn") return false;
  return NOISY_ERROR_PATTERN.test(message);
}

export function LogConsole({ logs }: { logs: DiscoveryLogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  const visibleLogs = showDetails ? logs : logs.filter((log) => !isLowLevelNoise(log.level, log.message));
  const hiddenCount = logs.length - visibleLogs.length;

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden lg:h-[520px]">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b px-4 py-3 sm:px-4 sm:py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalSquare className="h-4 w-4 text-brand" aria-hidden="true" />
          Worker console
          <span className="rounded-md border bg-muted/60 px-1.5 text-[11px] font-normal tabular-nums text-muted-foreground">
            {visibleLogs.length}
          </span>
        </CardTitle>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="rounded-sm text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showDetails ? "Hide low-level errors" : `Show ${hiddenCount} low-level errors`}
          </button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 sm:p-0">
        <div
          ref={ref}
          role="log"
          aria-live="polite"
          aria-label="Discovery worker log"
          tabIndex={0}
          className="h-full space-y-0.5 overflow-auto bg-background/80 px-4 py-3 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {visibleLogs.length === 0 && <p className="text-muted-foreground">Waiting for logs…</p>}
          {visibleLogs.map((log) => (
            <p key={log.id} className="whitespace-pre-wrap break-words">
              <span className={cn("font-semibold", levelColor(log.level))}>{log.level.toUpperCase().padEnd(6)}</span>{" "}
              <span className="mr-2 text-muted-foreground/80">{new Date(log.createdAt).toLocaleTimeString()}</span>
              <LogMessage message={log.message} />
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LogMessage({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > MAX_INLINE_MESSAGE;
  if (!isLong || expanded) return <span>{message}</span>;
  return (
    <span>
      {message.slice(0, MAX_INLINE_MESSAGE)}…{" "}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-sm text-brand underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        more
      </button>
    </span>
  );
}

function levelColor(level: string): string {
  if (level === "error") return "text-destructive";
  if (level === "warn") return "text-warning";
  if (level === "event" || level === "info") return "text-info";
  if (level === "action") return "text-success";
  return "text-muted-foreground";
}
