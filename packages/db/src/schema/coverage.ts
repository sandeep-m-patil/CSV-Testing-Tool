import { boolean, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { discoveredActions, discoveredPages } from "./discovery";
import { modules } from "./project";
import { testCases, testRunResults } from "./workflow";

/**
 * Coverage is role x action, not page count.
 *
 * A target is one thing a role should be able to do on a page ("submit the
 * contact form"). A link ties a test case to a target, and a record is the
 * outcome of that link in one run, so coverage is derived from what was
 * actually executed rather than from what a generator claimed it would cover.
 */
export const coverageTargets = pgTable(
  "coverage_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => discoveredPages.id, { onDelete: "cascade" }),
    /** Role that should be able to perform this, e.g. `admin`, `anonymous`. */
    role: varchar("role", { length: 120 }).notNull(),
    /** Action verb, e.g. `submit`, `add-to-cart`, `search`. */
    action: varchar("action", { length: 80 }).notNull(),
    /** Target discovered while crawling, when the action came from the app. */
    discoveredActionId: uuid("discovered_action_id").references(() => discoveredActions.id, {
      onDelete: "set null",
    }),
    label: varchar("label", { length: 200 }).notNull(),
    /** `critical` targets gate the module's coverage percentage. */
    isCritical: boolean("is_critical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("coverage_targets_module_id_idx").on(table.moduleId),
    index("coverage_targets_role_idx").on(table.role),
    index("coverage_targets_page_id_idx").on(table.pageId),
    uniqueIndex("coverage_targets_module_role_action_idx").on(table.moduleId, table.role, table.action, table.pageId),
  ],
);
export type CoverageTargetRow = typeof coverageTargets.$inferSelect;
export type NewCoverageTargetRow = typeof coverageTargets.$inferInsert;

/** Which test case is meant to cover which target. */
export const coverageLinks = pgTable(
  "coverage_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => coverageTargets.id, { onDelete: "cascade" }),
    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("coverage_links_target_case_idx").on(table.targetId, table.testCaseId),
    index("coverage_links_test_case_id_idx").on(table.testCaseId),
  ],
);
export type CoverageLinkRow = typeof coverageLinks.$inferSelect;
export type NewCoverageLinkRow = typeof coverageLinks.$inferInsert;

/** The observed outcome of a linked target within one run. */
export const coverageRecords = pgTable(
  "coverage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => coverageTargets.id, { onDelete: "cascade" }),
    testRunResultId: uuid("test_run_result_id")
      .notNull()
      .references(() => testRunResults.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 8 }).notNull().default("SKIP"),
    /** Run in which this record was produced, for fast per-run rollups. */
    runId: uuid("run_id").notNull(),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("coverage_records_target_id_idx").on(table.targetId),
    index("coverage_records_run_id_idx").on(table.runId),
    index("coverage_records_status_idx").on(table.status),
    uniqueIndex("coverage_records_result_attempt_idx").on(table.testRunResultId, table.attempt),
  ],
);
export type CoverageRecordRow = typeof coverageRecords.$inferSelect;
export type NewCoverageRecordRow = typeof coverageRecords.$inferInsert;
