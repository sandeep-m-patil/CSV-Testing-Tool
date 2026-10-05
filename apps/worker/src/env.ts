import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .string()
  .default("true")
  .transform((value) => !["0", "false", "no"].includes(value.toLowerCase()));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
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

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./data/storage"),
  STORAGE_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),

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
   * Optional semantic-target agent. Disabled unless all three are set, so the
   * locator fallback chain degrades instead of failing without them.
   */
  JEV_API_KEY: z.string().optional(),
  JEV_BASE_URL: z.string().optional(),
  JEV_TEXT_MODEL: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export const env: WorkerEnv = envSchema.parse(process.env);