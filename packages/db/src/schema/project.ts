import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * A project IS the application under test: it owns the base URL and the
 * modules (scoped areas of the site) that discovery and tests run against.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    baseUrl: text("base_url").notNull(),
    environment: varchar("environment", { length: 24 }).notNull().default("development"),
    productionConfirmed: boolean("production_confirmed").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("projects_created_by_idx").on(table.createdBy),
    index("projects_created_at_idx").on(table.createdAt),
    index("projects_environment_idx").on(table.environment),
  ],
);
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    startPath: text("start_path"),
    includePaths: jsonb("include_paths").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 24 }).notNull().default("ACTIVE"),
    discoveryStatus: varchar("discovery_status", { length: 24 }).notNull().default("NOT_DISCOVERED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("modules_project_id_idx").on(table.projectId),
    index("modules_discovery_status_idx").on(table.discoveryStatus),
    index("modules_created_at_idx").on(table.createdAt),
  ],
);
export type ModuleRow = typeof modules.$inferSelect;
export type NewModuleRow = typeof modules.$inferInsert;
