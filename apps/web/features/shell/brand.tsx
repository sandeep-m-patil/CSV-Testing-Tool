import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product mark + name. `compact` drops the tagline for the mobile top bar. */
export function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href="/projects"
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm",
          compact ? "h-7 w-7" : "h-8 w-8",
        )}
      >
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold tracking-tight">Autotest</span>
        {compact ? null : (
          <span className="block truncate text-[11px] text-muted-foreground">Discovery &amp; test generation</span>
        )}
      </span>
    </Link>
  );
}
