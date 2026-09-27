import { z } from "zod";

export const StorageDriverSchema = z.enum(["local", "s3"]);
export type StorageDriver = z.infer<typeof StorageDriverSchema>;

export const AiProviderKindSchema = z.enum(["mock", "openai", "local"]);
export type AiProviderKind = z.infer<typeof AiProviderKindSchema>;

export const SharedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .min(1, "CREDENTIAL_ENCRYPTION_KEY is required")
    .transform((value) => value)
    .refine((value) => {
      try {
        const withoutPadding = value.replace(/=+$/, "");
        return Math.floor((withoutPadding.length * 3) / 4) >= 32;
      } catch {
        return false;
      }
    }, "CREDENTIAL_ENCRYPTION_KEY must be 32+ bytes base64-encoded"),
  STORAGE_DRIVER: StorageDriverSchema.default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./data/storage"),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  AI_PROVIDER: AiProviderKindSchema.default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  LOCAL_AI_BASE_URL: z.string().url().optional(),
  LOCAL_AI_MODEL: z.string().default("llama3.1"),
});
export type SharedEnv = z.infer<typeof SharedEnvSchema>;

export const WebEnvSchema = SharedEnvSchema.extend({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});
export type WebEnv = z.infer<typeof WebEnvSchema>;

export const WorkerEnvSchema = SharedEnvSchema.extend({
  BROWSER_HEADLESS: z
    .string()
    .transform((value) => value === "true" || value === "1")
    .default("true"),
  DISCOVERY_MAX_PAGES: z.coerce.number().int().min(1).max(200).default(20),
  DISCOVERY_MAX_STEPS: z.coerce.number().int().min(10).max(5000).default(200),
  DISCOVERY_NAVIGATION_DEPTH: z.coerce.number().int().min(1).max(10).default(3),
  DISCOVERY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  DEMO_APP_URL: z.string().url().optional(),
});
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;