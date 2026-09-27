import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: ["./src/schema/auth.ts", "./src/schema/project.ts", "./src/schema/config.ts", "./src/schema/discovery.ts", "./src/schema/workflow.ts", "./src/schema/artifacts.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/autotest",
  },
  strict: true,
  verbose: true,
  casing: "snake_case",
});