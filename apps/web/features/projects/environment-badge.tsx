import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

type EnvironmentVariant = "success" | "warning" | "destructive" | "muted";

/** Production is red (handle with care), staging amber, QA green, everything else neutral. */
export function environmentBadgeVariant(environment: string): EnvironmentVariant {
  if (environment === "production") return "destructive";
  if (environment === "staging") return "warning";
  if (environment === "qa") return "success";
  return "muted";
}

/** "qa" -> "QA", everything else title-cased. */
function environmentLabel(environment: string): string {
  return environment.toLowerCase() === "qa" ? "QA" : titleCase(environment);
}

export function EnvironmentBadge({ environment, className }: { environment: string; className?: string }) {
  return (
    <Badge variant={environmentBadgeVariant(environment)} className={className}>
      {environmentLabel(environment)}
    </Badge>
  );
}
