import { createHash } from "node:crypto";

/**
 * Findings are grouped by fingerprint so a single defect reads as one issue.
 *
 * A broken checkout fails on every run and in every environment. Without
 * grouping, one bug becomes a hundred rows and nobody can tell whether it is
 * being fixed. The fingerprint must therefore be stable across runs and
 * environments, which means it is built from *what* is wrong and never from
 * *when* it was seen.
 */

export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingCategory = "functional" | "visual" | "accessibility" | "performance" | "content";

export interface FindingInput {
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  pageUrl: string | null;
  detail: string | null;
  evidenceKey: string | null;
  runId: string | null;
  environmentId: string | null;
}

export interface GroupedFinding {
  fingerprint: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  occurrences: FindingInput[];
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Collapses a URL to origin plus normalised path, so ids and queries do not fragment a group. */
function normaliseUrl(url: string | null): string {
  if (url === null) return "none";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.host}${path}`;
  } catch {
    return "unparseable";
  }
}

/** Strips evidence keys and volatile values so a retry does not create a new group. */
function normaliseDetail(detail: string | null): string {
  if (detail === null) return "none";
  return detail
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<timestamp>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\d+/g, "<n>")
    .slice(0, 400);
}

/**
 * Builds the stable identity of a finding.
 *
 * Severity and evidence are excluded on purpose: a defect escalated from medium
 * to critical is the same defect, and it must land in the group that already
 * tracks its history rather than starting a new one.
 */
export function findingFingerprint(finding: FindingInput): string {
  const parts = [
    finding.category,
    finding.title.trim().toLowerCase().replace(/\s+/g, " "),
    normaliseUrl(finding.pageUrl),
    normaliseDetail(finding.detail),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Collapses findings from a run into groups, worst severity leading each group. */
export function groupFindings(findings: FindingInput[]): GroupedFinding[] {
  const groups = new Map<string, GroupedFinding>();
  for (const finding of findings) {
    const fingerprint = findingFingerprint(finding);
    const existing = groups.get(fingerprint);
    if (!existing) {
      groups.set(fingerprint, {
        fingerprint,
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
        occurrences: [finding],
      });
      continue;
    }
    existing.occurrences.push(finding);
    if (SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[existing.severity]) {
      existing.severity = finding.severity;
    }
  }
  return [...groups.values()].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

export interface FindingSummary {
  total: number;
  groups: number;
  bySeverity: Record<FindingSeverity, number>;
  recurring: number;
  percentage: number;
}

/** Counts groups, not occurrences, so a summary is not dominated by one broken flow. */
export function summariseFindings(groups: GroupedFinding[]): FindingSummary {
  const bySeverity: Record<FindingSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let recurring = 0;
  for (const group of groups) {
    bySeverity[group.severity] += 1;
    if (group.occurrences.length > 1) recurring += 1;
  }
  return {
    total: groups.length,
    groups: groups.length,
    bySeverity,
    recurring,
    percentage: percentage(bySeverity.critical + bySeverity.high, groups.length),
  };
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}
