import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary and secondary actions, right-aligned on desktop and wrapped below the title on phones. */
  actions?: React.ReactNode;
  /** Trail shown above the title; the last item is the current page. */
  breadcrumbs?: BreadcrumbItem[];
  /** Inline adornment next to the title, e.g. a status badge. */
  meta?: React.ReactNode;
  /** Optional leading icon tile. */
  icon?: React.ReactNode;
  className?: string;
}

/** The single page-level heading block: breadcrumbs, h1, description and actions. */
export function PageHeader({ title, description, actions, breadcrumbs, meta, icon, className }: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground sm:flex [&_svg]:size-5">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              {meta}
            </div>
            {description ? (
              <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-foreground/80" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
