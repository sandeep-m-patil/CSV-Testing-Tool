import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { discoverySessions } from "./discovery";
import { modules } from "./project";
import { testDataSets } from "./config";
import { environments } from "./environment";

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    preconditions: jsonb("preconditions").notNull().default([]),
    steps: jsonb("steps").notNull().default([]),
    status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
    source: varchar("source", { length: 24 }).notNull().default("discovered"),
    confidence: varchar("confidence", { length: 8 }).notNull().default("1.0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workflows_module_id_idx").on(table.moduleId),
    index("workflows_session_id_idx").on(table.discoverySessionId),
    index("workflows_status_idx").on(table.status),
    index("workflows_created_at_idx").on(table.createdAt),
  ],
);
export type WorkflowRow = typeof workflows.$inferSelect;
export type NewWorkflowRow = typeof workflows.$inferInsert;

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    action: varchar("action", { length: 24 }).notNull(),
    target: text("target").notNull(),
    value: text("value"),
    optional: boolean("optional").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workflow_steps_workflow_id_idx").on(table.workflowId),
    index("workflow_steps_workflow_order_idx").on(table.workflowId, table.order),
  ],
);
export type WorkflowStepRow = typeof workflowSteps.$inferSelect;
export type NewWorkflowStepRow = typeof workflowSteps.$inferInsert;

export const testCases = pgTable(
  "test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  discoverySessionId: uuid("discovery_session_id").references(() => discoverySessions.id, { onDelete: "set null" }),
  code: varchar("code", { length: 64 }),
  name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 24 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("MEDIUM"),
    status: varchar("status", { length: 16 }).notNull().default("DRAFT"),
    source: varchar("source", { length: 24 }).notNull().default("discovered"),
    role: varchar("role", { length: 120 }),
    precondition: text("precondition"),
    testData: text("test_data"),
    expectedResult: text("expected_result"),
    /**
     * Dataset this case is data-driven by. When set, the case is executed once
     * per row, substituting `{{column}}` tokens in step values.
     */
    datasetId: uuid("dataset_id").references(() => testDataSets.id, { onDelete: "set null" }),
    steps: jsonb("steps").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
  index("test_cases_module_id_idx").on(table.moduleId),
  uniqueIndex("test_cases_module_code_idx").on(table.moduleId, table.code),
  index("test_cases_workflow_id_idx").on(table.workflowId),
    index("test_cases_session_id_idx").on(table.discoverySessionId),
    index("test_cases_status_idx").on(table.status),
    index("test_cases_dataset_id_idx").on(table.datasetId),
    index("test_cases_created_at_idx").on(table.createdAt),
  ],
);
export type TestCaseRow = typeof testCases.$inferSelect;
export type NewTestCaseRow = typeof testCases.$inferInsert;

export const testCaseSteps = pgTable(
  "test_case_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    action: varchar("action", { length: 24 }).notNull(),
    target: text("target").notNull(),
    value: text("value"),
    stepType: varchar("step_type", { length: 16 }).notNull().default("action"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("test_case_steps_test_case_id_idx").on(table.testCaseId),
    index("test_case_steps_order_idx").on(table.testCaseId, table.order),
  ],
);
export type TestCaseStepRow = typeof testCaseSteps.$inferSelect;
export type NewTestCaseStepRow = typeof testCaseSteps.$inferInsert;

export const testRuns = pgTable(
  "test_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    triggeredBy: uuid("triggered_by"),
    /** Deployment target this run was executed against. */
    environmentId: uuid("environment_id").references(() => environments.id, { onDelete: "set null" }),
    /** Target base URL as resolved at run time, so a later rename cannot rewrite history. */
    baseUrl: text("base_url"),
    status: varchar("status", { length: 16 }).notNull().default("QUEUED"),
    totalCases: integer("total_cases").notNull().default(0),
    passedCases: integer("passed_cases").notNull().default(0),
    failedCases: integer("failed_cases").notNull().default(0),
    skippedCases: integer("skipped_cases").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("test_runs_module_id_idx").on(table.moduleId),
    index("test_runs_status_idx").on(table.status),
    index("test_runs_environment_id_idx").on(table.environmentId),
    index("test_runs_created_at_idx").on(table.createdAt),
  ],
);
export type TestRunRow = typeof testRuns.$inferSelect;
export type NewTestRunRow = typeof testRuns.$inferInsert;

export const testRunResults = pgTable(
  "test_run_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    testRunId: uuid("test_run_id")
      .notNull()
      .references(() => testRuns.id, { onDelete: "cascade" }),
    testCaseId: uuid("test_case_id")
      .notNull()
      .references(() => testCases.id, { onDelete: "cascade" }),
    /** Set when this result came from expanding a data-driven case. */
    datasetId: uuid("dataset_id").references(() => testDataSets.id, { onDelete: "set null" }),
    datasetRow: integer("dataset_row"),
    status: varchar("status", { length: 8 }).notNull().default("SKIP"),
    durationMs: integer("duration_ms"),
    testData: text("test_data"),
    expectedResult: text("expected_result"),
    actualResult: text("actual_result"),
    error: text("error"),
    screenshotKey: text("screenshot_key"),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("test_run_results_run_id_idx").on(table.testRunId),
    index("test_run_results_case_id_idx").on(table.testCaseId),
    index("test_run_results_status_idx").on(table.status),
    index("test_run_results_dataset_id_idx").on(table.datasetId),
  ],
);
export type TestRunResultRow = typeof testRunResults.$inferSelect;
export type NewTestRunResultRow = typeof testRunResults.$inferInsert;