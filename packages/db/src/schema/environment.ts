import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { projects } from "./project";

/**
 * A deployment target for a project: one application, several environments.
 *
 * The project's `baseUrl` stays the canonical entry point so existing projects,
 * modules, discovery sessions and test cases keep working. An environment
 * overrides it for a specific run, which is what lets the same discovered
 * application be retested against staging or production without rediscovering it.
 */
export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    /** `development`, `staging`, `production`, or any custom label. */
    kind: varchar("kind", { length: 24 }).notNull().default("development"),
    baseUrl: text("base_url").notNull(),
    /** Paths appended to the base URL when tests start, e.g. `/app`. */
    basePaths: jsonb("base_paths").$type<string[]>().notNull().default([]),
    /** Secret names this environment needs; values are stored encrypted, never here. */
    requiredCredentials: jsonb("required_credentials").$type<string[]>().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("environments_project_id_idx").on(table.projectId),
    index("environments_kind_idx").on(table.kind),
    uniqueIndex("environments_project_name_idx").on(table.projectId, table.name),
  ],
);
export type EnvironmentRow = typeof environments.$inferSelect;
export type NewEnvironmentRow = typeof environments.$inferInsert;
