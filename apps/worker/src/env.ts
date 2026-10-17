import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .string()
  .default("true")
  .transform((value) => !["0", "false", "no"].includes(value.toLowerCase()));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),

  BROWSER_HEADLESS: booleanFromString,
  BROWSER_ISOLATED_CONTEXT: booleanFromString,

  DISCOVERY_MAX_PAGES: z.coerce.number().int().positive().default(20),
  DISCOVERY_MAX_STEPS: z.coerce.number().int().positive().default(200),
  DISCOVERY_NAVIGATION_DEPTH: z.coerce.number().int().min(1).max(5).default(3),
  DISCOVERY_MAX_ACTIONS_PER_PAGE: z.coerce.number().int().min(1).max(40).default(8),
  DISCOVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DISCOVERY_PAGE_SLEEP_MS: z.coerce.number().int().min(0).default(350),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Files UPLOAD steps may attach, by base name. Missing names get a generated placeholder. */
  UPLOAD_FIXTURES_DIR: z.string().default("./data/fixtures"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./data/storage"),
  STORAGE_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  /** S3-compatible bucket (Neon Storage, R2, AWS) used when STORAGE_DRIVER=s3. */
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  AI_PROVIDER: z.enum(["mock", "openai", "gemini", "grok", "local"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  /** xAI Grok, via its OpenAI-compatible endpoint. */
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.string().optional(),
  XAI_MODEL: z.string().optional(),
  LOCAL_AI_BASE_URL: z.string().optional(),
  LOCAL_AI_MODEL: z.string().optional(),

  /**
   * Browser agent (Playwright + AI_PROVIDER). When a real provider is set,
   * discovery asks it before clicking submit-like controls and skips anything
   * that looks irreversible (order, payment, message, delete, approve, publish).
   */
  AGENT_GUARD_IRREVERSIBLE: booleanFromString,
});

export type WorkerEnv = z.infer<typeof envSchema>;

export const env: WorkerEnv = envSchema.parse(process.env);