import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { discoverySessions } from "./discovery";
import { modules } from "./project";

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
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 24 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("MEDIUM"),
    status: varchar("status", { length: 16 }).notNull().default("DRAFT"),
    source: varchar("source", { length: 24 }).notNull().default("discovered"),
    role: varchar("role", { length: 120 }),
    precondition: text("precondition"),
    steps: jsonb("steps").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("test_cases_module_id_idx").on(table.moduleId),
    index("test_cases_workflow_id_idx").on(table.workflowId),
    index("test_cases_session_id_idx").on(table.discoverySessionId),
    index("test_cases_status_idx").on(table.status),
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