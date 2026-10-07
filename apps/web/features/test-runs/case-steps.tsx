"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttemptView, StepView } from "@/features/hooks";
import { StatusBadge, StatusIcon } from "./status";

/**
 * Screenshot-first evidence for one case: each step with its own screenshot,
 * then the attempt history when the case was retried.
 */
export function CaseSteps({ steps, attempts, onOpenImage }: { steps: StepView[]; attempts: AttemptView[]; onOpenImage?: (url: string, title: string) => void }) {
  return (
    <div className="space-y-3">
      {attempts.length > 1 && <AttemptTimeline attempts={attempts} />}
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">No step evidence recorded for this result.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
            <StepCard key={step.order} step={step} onOpenImage={onOpenImage} />
          ))}
        </ol>
      )}
    </div>
  );
}

function StepCard({ step, onOpenImage }: { step: StepView; onOpenImage?: (url: string, title: string) => void }) {
  const title = `Step ${step.order}: ${step.action} ${step.target}`;
  return (
    <li className="print-block overflow-hidden rounded-lg border bg-card">
      {step.screenshotUrl ? (
        <button type="button" className="block w-full border-b bg-muted/30" onClick={() => onOpenImage?.(step.screenshotUrl!, title)} aria-label={`Open screenshot for step ${step.order}`}>
          <img src={step.screenshotUrl} alt={title} className="block aspect-video w-full object-cover object-top" />
        </button>
      ) : (
        <div className="flex aspect-video items-center justify-center border-b bg-muted/20 text-xs text-muted-foreground">no screenshot</div>
      )}
      <div className="space-y-1 p-2.5">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={step.status} />
          <span className="text-xs font-semibold">Step {step.order}</span>
          <code className="rounded bg-muted px-1 text-[11px]">{step.action}</code>
          {step.resolvedBy === "jev" && (
            <Badge variant="info" className="gap-1 px-1.5 py-0 text-[10px]">
              <Sparkles className="h-3 w-3" />
              Jev
            </Badge>
          )}
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{step.durationMs} ms</span>
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={step.target}>
          {step.target}
          {step.value !== undefined && ` = "${step.value}"`}
        </p>
        {step.error && <p className="text-[11px] text-destructive">{step.error}</p>}
      </div>
    </li>
  );
}

function AttemptTimeline({ attempts }: { attempts: AttemptView[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
      <span className="font-medium text-muted-foreground">Attempts</span>
      {attempts.map((attempt) => (
        <span key={attempt.attempt} className="inline-flex items-center gap-1" title={attempt.error ?? undefined}>
          #{attempt.attempt}
          <StatusBadge status={attempt.status} />
        </span>
      ))}
    </div>
  );
}
