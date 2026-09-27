import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { modules } from "./project";

export const discoverySessions = pgTable(
  "discovery_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("QUEUED"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    currentUrl: text("current_url"),
    currentStep: text("current_step"),
    pagesDiscovered: integer("pages_discovered").notNull().default(0),
    actionsDiscovered: integer("actions_discovered").notNull().default(0),
    workflowsDiscovered: integer("workflows_discovered").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovery_sessions_module_id_idx").on(table.moduleId),
    index("discovery_sessions_status_idx").on(table.status),
    index("discovery_sessions_created_at_idx").on(table.createdAt),
  ],
);
export type DiscoverySessionRow = typeof discoverySessions.$inferSelect;
export type NewDiscoverySessionRow = typeof discoverySessions.$inferInsert;

export const discoveredPages = pgTable(
  "discovered_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    pageType: varchar("page_type", { length: 24 }).notNull().default("other"),
    parentPageId: uuid("parent_page_id"),
    order: integer("order").notNull().default(0),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovered_pages_session_id_idx").on(table.discoverySessionId),
    index("discovered_pages_module_id_idx").on(table.moduleId),
    index("discovered_pages_order_idx").on(table.discoverySessionId, table.order),
  ],
);
export type DiscoveredPageRow = typeof discoveredPages.$inferSelect;
export type NewDiscoveredPageRow = typeof discoveredPages.$inferInsert;

export const discoveredElements = pgTable(
  "discovered_elements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => discoveredPages.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    elementType: varchar("element_type", { length: 24 }).notNull(),
    role: varchar("role", { length: 64 }),
    name: text("name"),
    text: text("text"),
    placeholder: text("placeholder"),
    label: text("label"),
    testId: text("test_id"),
    cssSelector: text("css_selector"),
    xpath: text("xpath"),
    ariaAttributes: jsonb("aria_attributes"),
    visible: boolean("visible").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovered_elements_session_id_idx").on(table.discoverySessionId),
    index("discovered_elements_page_id_idx").on(table.pageId),
    index("discovered_elements_module_id_idx").on(table.moduleId),
    index("discovered_elements_type_idx").on(table.elementType),
  ],
);
export type DiscoveredElementRow = typeof discoveredElements.$inferSelect;
export type NewDiscoveredElementRow = typeof discoveredElements.$inferInsert;

export const discoveredActions = pgTable(
  "discovered_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => discoveredPages.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 24 }).notNull(),
    target: jsonb("target").notNull(),
    dangerous: boolean("dangerous").notNull().default(false),
    blocked: boolean("blocked").notNull().default(false),
    executed: boolean("executed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovered_actions_session_id_idx").on(table.discoverySessionId),
    index("discovered_actions_page_id_idx").on(table.pageId),
    index("discovered_actions_module_id_idx").on(table.moduleId),
    index("discovered_actions_type_idx").on(table.action),
  ],
);
export type DiscoveredActionRow = typeof discoveredActions.$inferSelect;
export type NewDiscoveredActionRow = typeof discoveredActions.$inferInsert;

export const stateTransitions = pgTable(
  "state_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    fromPageId: uuid("from_page_id")
      .notNull()
      .references(() => discoveredPages.id, { onDelete: "cascade" }),
    toPageId: uuid("to_page_id")
      .notNull()
      .references(() => discoveredPages.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").references(() => discoveredActions.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("state_transitions_session_id_idx").on(table.discoverySessionId),
    index("state_transitions_module_id_idx").on(table.moduleId),
    index("state_transitions_from_page_idx").on(table.fromPageId),
  ],
);
export type StateTransitionRow = typeof stateTransitions.$inferSelect;
export type NewStateTransitionRow = typeof stateTransitions.$inferInsert;

export const discoveryLogs = pgTable(
  "discovery_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    level: varchar("level", { length: 16 }).notNull().default("info"),
    message: text("message").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovery_logs_session_id_idx").on(table.discoverySessionId),
    index("discovery_logs_created_at_idx").on(table.discoverySessionId, table.createdAt),
  ],
);
export type DiscoveryLogRow = typeof discoveryLogs.$inferSelect;
export type NewDiscoveryLogRow = typeof discoveryLogs.$inferInsert;