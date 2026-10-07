import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatStepValue } from "@/lib/test-cases/step-display";

export interface DisplayStep {
  order: number;
  action: string;
  target: string;
  value?: string;
  optional?: boolean;
  type?: string;
}

/**
 * Numbered step timeline shared by workflows and test cases. Values go through
 * `formatStepValue`, so credential tokens render as labels and never as secrets.
 */
export function StepList({ steps }: { steps: DisplayStep[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.order} className="flex items-start gap-2.5 text-sm">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-muted/60 text-[10px] font-medium tabular-nums text-muted-foreground"
          >
            {step.order}
          </span>
          <span className={cn("min-w-0 break-words leading-6", step.optional ? "text-muted-foreground" : "")}>
            <code className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-foreground/90">
              {step.action}
            </code>{" "}
            <span className="font-mono text-xs text-muted-foreground">{step.target}</span>
            {step.value !== undefined && (
              <span className="text-xs text-muted-foreground">
                {" "}
                = <span className="text-foreground/80">“{formatStepValue(step.value)}”</span>
              </span>
            )}
            {step.optional && (
              <Badge variant="muted" className="ml-1.5 align-middle">
                optional
              </Badge>
            )}
            {step.type === "assertion" && (
              <Badge variant="info" className="ml-1.5 align-middle">
                assertion
              </Badge>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
