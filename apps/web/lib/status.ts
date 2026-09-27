export type StatusVariant = "success" | "warning" | "destructive" | "muted" | "info";

/** Module / discovery status -> badge variant. Green = done, amber = running, red = failed. */
export function discoveryStatusVariant(status: string | null | undefined): StatusVariant {
  switch (status) {
    case "DISCOVERED":
    case "COMPLETED":
      return "success";
    case "DISCOVERING":
    case "RUNNING":
    case "QUEUED":
      return "warning";
    case "FAILED":
    case "CANCELLED":
      return "destructive";
    default:
      return "muted";
  }
}

/** Lifecycle status used by discovery sessions and workflows. */
export function runStatusVariant(status: string | null | undefined): StatusVariant {
  switch (status) {
    case "COMPLETED":
    case "PASSED":
    case "success":
      return "success";
    case "RUNNING":
    case "QUEUED":
    case "PENDING":
    case "pending":
      return "warning";
    case "FAILED":
    case "failed":
      return "destructive";
    case "SKIPPED":
    case "skipped":
    case "BLOCKED":
      return "muted";
    default:
      return "muted";
  }
}
