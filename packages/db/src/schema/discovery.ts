import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
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
    /** Route identity with dynamic segments collapsed, e.g. `/materials/:id`. */
    routePattern: varchar("route_pattern", { length: 300 }),
    /** Hash-free identity used to recognise the same page reached twice. */
    canonicalUrl: text("canonical_url"),
    /** Stable hash of the page's identity: title, type and route pattern. */
    pageFingerprint: varchar("page_fingerprint", { length: 64 }),
    /** Hash of the visible DOM shape; changes when the page's content changes. */
    domFingerprint: varchar("dom_fingerprint", { length: 64 }),
    /** Set when this row represents a UI state rather than a whole page. */
    uiStateId: uuid("ui_state_id"),
    /** Credential role this page was observed under, e.g. `admin`. */
    role: varchar("role", { length: 120 }),
    /**
     * AI's page classification. Advisory only: the deterministic classifier
     * stays authoritative for scoping, and the model never decides PASS/FAIL.
     */
    aiPageType: varchar("ai_page_type", { length: 24 }),
    aiPurpose: text("ai_purpose"),
    aiFields: jsonb("ai_fields"),
    aiActions: jsonb("ai_actions"),
    /** Which provider produced the AI columns: `mock`, `gemini`, `grok`, ... */
    aiSource: varchar("ai_source", { length: 16 }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovered_pages_session_id_idx").on(table.discoverySessionId),
    index("discovered_pages_module_id_idx").on(table.moduleId),
    index("discovered_pages_order_idx").on(table.discoverySessionId, table.order),
    index("discovered_pages_route_pattern_idx").on(table.moduleId, table.routePattern),
    index("discovered_pages_canonical_url_idx").on(table.discoverySessionId, table.canonicalUrl),
    index("discovered_pages_role_idx").on(table.moduleId, table.role),
    uniqueIndex("discovered_pages_session_route_pattern_unique").on(
      table.discoverySessionId,
      table.moduleId,
      table.routePattern,
      table.pageFingerprint,
    ),
  ],
);
export type DiscoveredPageRow = typeof discoveredPages.$inferSelect;
export type NewDiscoveredPageRow = typeof discoveredPages.$inferInsert;

/**
 * A distinct UI state of a page: same route, different rendered result, for
 * example an open modal or a filled-in form. Stored separately from pages so
 * coverage can reason about states rather than only URLs.
 */
export const uiStates = pgTable(
  "ui_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => discoveredPages.id, { onDelete: "cascade" }),
    routePattern: varchar("route_pattern", { length: 300 }),
    /** Hash of the DOM shape that makes this state distinct from its siblings. */
    stateFingerprint: varchar("state_fingerprint", { length: 64 }).notNull(),
    name: varchar("name", { length: 200 }),
    triggerLabel: text("trigger_label"),
    triggerSelector: text("trigger_selector"),
    isModal: boolean("is_modal").notNull().default(false),
    /** Redacted, structured snapshot: no screenshots, no raw HTML bodies. */
    snapshot: jsonb("snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ui_states_session_idx").on(table.discoverySessionId),
    index("ui_states_module_idx").on(table.moduleId),
    index("ui_states_page_idx").on(table.pageId),
    uniqueIndex("ui_states_page_fingerprint_unique").on(table.pageId, table.stateFingerprint),
  ],
);
export type UiStateRow = typeof uiStates.$inferSelect;
export type NewUiStateRow = typeof uiStates.$inferInsert;

/**
 * A directed navigation edge between pages or UI states. `toPageId` is null
 * when the target has not been discovered yet, so unvisited links still form a
 * usable graph instead of being dropped.
 */
export const navigationEdges = pgTable(
  "navigation_edges",
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
    toPageId: uuid("to_page_id").references(() => discoveredPages.id, { onDelete: "cascade" }),
    fromRoutePattern: varchar("from_route_pattern", { length: 300 }),
    toRoutePattern: varchar("to_route_pattern", { length: 300 }),
    toUrl: text("to_url"),
    label: text("label"),
    action: varchar("action", { length: 24 }).notNull().default("navigate"),
    /** Credential role the edge was observed under, e.g. `guest` or `admin`. */
    role: varchar("role", { length: 120 }),
    isNewPage: boolean("is_new_page").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("navigation_edges_session_idx").on(table.discoverySessionId),
    index("navigation_edges_module_idx").on(table.moduleId),
    index("navigation_edges_from_idx").on(table.fromPageId),
    index("navigation_edges_to_idx").on(table.toPageId),
  ],
);
export type NavigationEdgeRow = typeof navigationEdges.$inferSelect;
export type NewNavigationEdgeRow = typeof navigationEdges.$inferInsert;

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
    /** HTML `type` of an input, e.g. `email`, `tel`, `password`. */
    inputType: varchar("input_type", { length: 32 }),
    /** HTML `autocomplete` hint, the strongest signal for a field's purpose. */
    autocomplete: varchar("autocomplete", { length: 32 }),
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