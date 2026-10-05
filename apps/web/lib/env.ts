import { z } from "zod";

const webEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./data/storage"),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // AI. Discovery stays deterministic when no key is present: `mock` is the
  // default and every provider is optional so the app boots without one.
  AI_PROVIDER: z.enum(["mock", "openai", "gemini", "grok", "local"]).default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.string().optional(),
  XAI_MODEL: z.string().optional(),
  LOCAL_AI_BASE_URL: z.string().optional(),
  LOCAL_AI_MODEL: z.string().optional(),

  // SSRF guard for user-supplied base URLs.
  ALLOW_PRIVATE_TARGETS: z
    .string()
    .default("false")
    .transform((value) => !["0", "false", "no"].includes(value.toLowerCase())),

  // Jev semantic target resolver (optional).
  JEV_API_KEY: z.string().optional(),
  JEV_BASE_URL: z.string().optional(),
  JEV_TEXT_MODEL_API_KEY: z.string().optional(),
  JEV_TEXT_MODEL: z.string().optional(),
});

export const webEnv = webEnvSchema.parse(process.env);

export type WebEnv = z.infer<typeof webEnvSchema>;

export const getEnv = (): WebEnv => webEnv;