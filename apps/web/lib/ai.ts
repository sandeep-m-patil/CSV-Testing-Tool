import { createAIProvider, type AIProvider } from "@repo/ai";
import type { WebEnv } from "@/lib/env";

/**
 * Builds the AI provider for a web request from server-side env only.
 *
 * Keys are never exposed to the browser: this module is imported by route
 * handlers, never by client components. The factory throws when the selected
 * provider has no key, which callers turn into a clear 400 rather than a
 * silent fallback, so an operator never wonders why the app "ignored" the model.
 */
export function createWebAIProvider(env: WebEnv): AIProvider {
  return createAIProvider({
    provider: env.AI_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    openaiModel: env.OPENAI_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiBaseUrl: env.GEMINI_BASE_URL,
    geminiModel: env.GEMINI_MODEL,
    xaiApiKey: env.XAI_API_KEY,
    xaiBaseUrl: env.XAI_BASE_URL,
    xaiModel: env.XAI_MODEL,
    localBaseUrl: env.LOCAL_AI_BASE_URL,
    localModel: env.LOCAL_AI_MODEL,
  });
}

/** Which provider the deployment is configured to use, for the UI to display. */
export function describeAIConfig(env: WebEnv): { provider: string; configured: boolean } {
  const configured: Record<string, boolean> = {
    mock: true,
    openai: Boolean(env.OPENAI_API_KEY),
    gemini: Boolean(env.GEMINI_API_KEY),
    grok: Boolean(env.XAI_API_KEY),
    local: Boolean(env.LOCAL_AI_BASE_URL),
  };
  return { provider: env.AI_PROVIDER, configured: configured[env.AI_PROVIDER] ?? false };
}