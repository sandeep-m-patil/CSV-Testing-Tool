import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, closeAll } from "./index";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(dirname, "../drizzle");

const db = getDb();

try {
  console.log(`Applying migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied.");
  await closeAll();
  process.exit(0);
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? (error.stack ?? error.message) : error);
  await closeAll();
  process.exit(1);
}