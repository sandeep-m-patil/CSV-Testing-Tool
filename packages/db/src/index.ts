import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import { DATABASE_URL } from "./url";

export * as schema from "./schema/index";
export * from "./schema/index";

export type Db = PostgresJsDatabase<typeof schema>;

const clients = new Map<string, postgres.Sql>();

export function getDb(url: string = DATABASE_URL, maxConnections = 6): Db {
  let sql = clients.get(url);
  if (!sql) {
    sql = postgres(url, { max: maxConnections, prepare: false });
    clients.set(url, sql);
  }
  return drizzle(sql, { schema, casing: "snake_case" });
}

export function getDbRaw(url: string = DATABASE_URL, maxConnections = 6): postgres.Sql {
  return postgres(url, { max: maxConnections, prepare: false });
}

export async function closeAll(): Promise<void> {
  await Promise.all([...clients.values()].map((client) => client.end()));
  clients.clear();
}