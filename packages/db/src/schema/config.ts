import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { modules } from "./project";

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 120 }).notNull(),
    /** Nullable: a login may be identified by a field other than a username. */
    username: varchar("username", { length: 255 }),
    /** Names of the encrypted fields held in `secretData`, never their values. */
    fieldKeys: jsonb("field_keys").$type<string[]>().notNull().default([]),
    /** Which kind of form these credentials authenticate, e.g. `login`. */
    formType: varchar("form_type", { length: 16 }).notNull().default("login"),
    secretData: text("secret_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credentials_module_id_idx").on(table.moduleId),
    uniqueIndex("credentials_module_role_unique").on(table.moduleId, table.role),
  ],
);
export type CredentialRow = typeof credentials.$inferSelect;
export type NewCredentialRow = typeof credentials.$inferInsert;

export const testDataSets = pgTable(
  "test_data_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    dataType: varchar("data_type", { length: 24 }).notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("test_data_sets_module_id_idx").on(table.moduleId),
    index("test_data_sets_created_at_idx").on(table.createdAt),
  ],
);
export type TestDataSetRow = typeof testDataSets.$inferSelect;
export type NewTestDataSetRow = typeof testDataSets.$inferInsert;