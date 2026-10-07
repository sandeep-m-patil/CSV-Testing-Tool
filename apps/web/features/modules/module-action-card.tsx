import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ModuleActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
  step?: number;
}

/** Linked card for one stage of the module workflow (configure, discover, review, report). */
export function ModuleActionCard({ icon, title, description, href, cta, step }: ModuleActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm shadow-black/20 transition-colors hover:border-muted-foreground/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/60 text-brand [&_svg]:size-4">
          {icon}
        </span>
        {step ? <span className="text-xs font-medium tabular-nums text-muted-foreground">Step {step}</span> : null}
      </div>
      <p className="mt-4 font-semibold tracking-tight">{title}</p>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/90">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </p>
    </Link>
  );
}
