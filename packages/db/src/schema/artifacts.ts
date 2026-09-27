import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { discoveredActions, discoveredPages, discoverySessions } from "./discovery";
import { modules } from "./project";

export const discoveryArtifacts = pgTable(
  "discovery_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    actionId: uuid("action_id").references(() => discoveredActions.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => discoveredPages.id, { onDelete: "set null" }),
    artifactType: varchar("artifact_type", { length: 24 }).notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url"),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("discovery_artifacts_session_id_idx").on(table.discoverySessionId),
    index("discovery_artifacts_module_id_idx").on(table.moduleId),
    index("discovery_artifacts_type_idx").on(table.artifactType),
    index("discovery_artifacts_created_at_idx").on(table.createdAt),
  ],
);
export type DiscoveryArtifactRow = typeof discoveryArtifacts.$inferSelect;
export type NewDiscoveryArtifactRow = typeof discoveryArtifacts.$inferInsert;