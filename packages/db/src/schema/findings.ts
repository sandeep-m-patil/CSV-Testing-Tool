import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { modules } from "./project";
import { testRuns } from "./workflow";

/**
 * Findings are grouped by fingerprint, not listed individually.
 *
 * The same broken checkout fails on every run and in every environment; without
 * grouping a single defect reads as a hundred separate issues. A group is
 * stable across runs via `fingerprint`, so a regression reopens the same group
 * and its history stays readable.
 */
export const findingGroups = pgTable(
  "finding_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    /** `accessibility`, `visual`, `functional`, `performance`, `content`. */
    category: varchar("category", { length: 32 }).notNull().default("functional"),
    severity: varchar("severity", { length: 16 }).notNull().default("medium"),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    occurrences: integer("occurrences").notNull().default(1),
    firstSeenRunId: uuid("first_seen_run_id").references(() => testRuns.id, { onDelete: "set null" }),
    lastSeenRunId: uuid("last_seen_run_id").references(() => testRuns.id, { onDelete: "set null" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("finding_groups_module_fingerprint_idx").on(table.moduleId, table.fingerprint),
    index("finding_groups_module_status_idx").on(table.moduleId, table.status),
    index("finding_groups_severity_idx").on(table.severity),
  ],
);
export type FindingGroupRow = typeof findingGroups.$inferSelect;
export type NewFindingGroupRow = typeof findingGroups.$inferInsert;

/** One concrete occurrence of a group, pointing at the run that produced it. */
export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => findingGroups.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => testRuns.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id"),
    pageUrl: text("page_url"),
    title: varchar("title", { length: 240 }).notNull(),
    detail: text("detail"),
    severity: varchar("severity", { length: 16 }).notNull().default("medium"),
    /** Evidence lives in object storage; only the key is stored here. */
    evidenceKey: text("evidence_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("findings_group_id_idx").on(table.groupId),
    index("findings_run_id_idx").on(table.runId),
    index("findings_severity_idx").on(table.severity),
  ],
);
export type FindingRow = typeof findings.$inferSelect;
export type NewFindingRow = typeof findings.$inferInsert;
