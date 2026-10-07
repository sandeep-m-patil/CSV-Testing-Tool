import { index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { modules, projects } from "./project";
import { environments } from "./environment";

/**
 * Application roles of a project ("LAB_ANALYST", "Reviewer"...). Names are
 * free-form and configured per project; nothing in the platform hard-codes them.
 */
export const projectRoles = pgTable(
  "project_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("project_roles_project_name_idx").on(table.projectId, table.name)],
);
export type ProjectRoleRow = typeof projectRoles.$inferSelect;

/**
 * A login owned by the project and reused by any module that references it
 * through `module_credentials`. The secret is AES-256-GCM encrypted with a key
 * derived from `encryptionScope`; it never leaves the server in plaintext.
 */
export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Display name, unique per project ("Analyst - QA"). */
    name: varchar("name", { length: 120 }).notNull(),
    /** Application role this login acts as; matches a `project_roles.name`. */
    role: varchar("role", { length: 120 }).notNull(),
    /** Nullable: a login may be identified by a field other than a username. */
    username: varchar("username", { length: 255 }),
    /** Restricts the credential to one deployment; null means any environment. */
    environmentId: uuid("environment_id").references(() => environments.id, { onDelete: "set null" }),
    /** Non-secret values a test may reference as `{{name}}`, e.g. a lab or tenant id. */
    variables: jsonb("variables").$type<Record<string, string>>().notNull().default({}),
    /** Names of the encrypted fields held in `secretData`, never their values. */
    fieldKeys: jsonb("field_keys").$type<string[]>().notNull().default([]),
    /** Which kind of form these credentials authenticate, e.g. `login`. */
    formType: varchar("form_type", { length: 16 }).notNull().default("login"),
    secretData: text("secret_data").notNull(),
    /** Key-derivation scope: the project id for new rows, the old module id for migrated ones. */
    encryptionScope: varchar("encryption_scope", { length: 64 }).notNull(),
    /** Legacy owner from before credentials were centralized; superseded by `module_credentials`. */
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("credentials_project_id_idx").on(table.projectId),
    uniqueIndex("credentials_project_name_idx").on(table.projectId, table.name),
  ],
);
export type CredentialRow = typeof credentials.$inferSelect;
export type NewCredentialRow = typeof credentials.$inferInsert;

/** Which project credentials a module discovers and runs with. A reference, never a copy. */
export const moduleCredentials = pgTable(
  "module_credentials",
  {
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    credentialId: uuid("credential_id")
      .notNull()
      .references(() => credentials.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.moduleId, table.credentialId] }),
    index("module_credentials_credential_id_idx").on(table.credentialId),
  ],
);

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