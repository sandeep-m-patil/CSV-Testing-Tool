import { Download, Terminal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * What the browser reported beyond the screenshots: console and uncaught page
 * errors, and the Playwright trace of a failed attempt. Traces exist only for
 * cases that ran without a credential; a signed-in trace would contain secrets.
 */
export function FailureDiagnostics({ consoleErrors, traceUrl, code }: { consoleErrors: string[]; traceUrl: string | null; code: string }) {
  if (consoleErrors.length === 0 && !traceUrl) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-background/60 p-3 text-xs">
      {consoleErrors.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            Browser errors ({consoleErrors.length})
          </p>
          <ul className="max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-destructive">
            {consoleErrors.map((message, index) => (
              <li key={index} className="break-words">{message}</li>
            ))}
          </ul>
        </div>
      )}
      {traceUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href={traceUrl} download={`${code}-trace.zip`}>
            <Download className="h-3.5 w-3.5" />
            Playwright trace
          </a>
          <span className="text-muted-foreground">
            Open it with <code className="rounded bg-muted px-1">npx playwright show-trace {code}-trace.zip</code> to step through DOM, network and timing.
          </span>
        </div>
      )}
    </div>
  );
}
