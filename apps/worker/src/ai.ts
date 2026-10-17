import { createAIProvider, type AIProvider } from "@repo/ai";
import { env, type WorkerEnv } from "./env";

let cached: AIProvider | null = null;

/** The worker's model provider (Gemini, OpenAI-compatible, Grok, local, or mock), from env. */
export function getWorkerAI(): AIProvider {
  cached ??= createAIProvider(resolveAiConfig(env));
  return cached;
}

function resolveAiConfig(workerEnv: WorkerEnv) {
  return {
    provider: workerEnv.AI_PROVIDER,
    openaiApiKey: workerEnv.OPENAI_API_KEY ?? undefined,
    openaiBaseUrl: workerEnv.OPENAI_BASE_URL ?? undefined,
    openaiModel: workerEnv.OPENAI_MODEL ?? undefined,
    geminiApiKey: workerEnv.GEMINI_API_KEY ?? undefined,
    geminiBaseUrl: workerEnv.GEMINI_BASE_URL ?? undefined,
    geminiModel: workerEnv.GEMINI_MODEL ?? undefined,
    xaiApiKey: workerEnv.XAI_API_KEY ?? undefined,
    xaiBaseUrl: workerEnv.XAI_BASE_URL ?? undefined,
    xaiModel: workerEnv.XAI_MODEL ?? undefined,
    localBaseUrl: workerEnv.LOCAL_AI_BASE_URL ?? undefined,
    localModel: workerEnv.LOCAL_AI_MODEL ?? undefined,
  };
}
