import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Background jobs (discovery, test runs). See drizzle/0017_job_queue.sql. */
export const jobQueue = pgTable(
  "job_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: varchar("queue", { length: 32 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    data: jsonb("data").notNull(),
    /** queued → running → completed | failed (a failed attempt with retries left goes back to queued). */
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(1),
    backoffMs: integer("backoff_ms").notNull().default(5000),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 64 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("job_queue_claim_idx").on(table.queue, table.status, table.runAfter),
    index("job_queue_locked_idx").on(table.status, table.lockedAt),
  ],
);
export type JobQueueRow = typeof jobQueue.$inferSelect;
