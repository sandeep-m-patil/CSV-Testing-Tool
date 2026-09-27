"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className="flex h-[520px] flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 py-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TerminalSquare className="h-4 w-4 text-primary" />
          Worker console
        </CardTitle>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {showDetails ? "Hide low-level errors" : `Show ${hiddenCount} low-level errors`}
          </button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={ref}
          className="h-full overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-relaxed text-slate-200"
        >
          {visibleLogs.length === 0 && <p className="text-slate-500">Waiting for logs…</p>}
          {visibleLogs.map((log) => (
            <p key={log.id} className="whitespace-pre-wrap break-words">
              <span className={levelColor(log.level)}>{log.level.toUpperCase().padEnd(6)}</span>{" "}
              <span className="mr-2 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
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
        className="text-primary underline underline-offset-2"
      >
        more
      </button>
    </span>
  );
}

function levelColor(level: string): string {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-400";
  if (level === "event" || level === "info") return "text-primary";
  if (level === "action") return "text-emerald-400";
  return "text-slate-400";
}
