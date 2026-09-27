import type { AIProvider, AIProviderKind } from "./types";
import { MockProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai";
import { LocalModelProvider } from "./local";

export interface AIProviderConfig {
  provider: AIProviderKind;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  localBaseUrl?: string;
  localModel?: string;
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "openai": {
      if (!config.openaiApiKey) {
        throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
      }
      return new OpenAICompatibleProvider({
        label: "OpenAI-compatible",
        apiKey: config.openaiApiKey,
        baseUrl: config.openaiBaseUrl ?? "https://api.openai.com/v1",
        model: config.openaiModel ?? "gpt-4o-mini",
      });
    }
    case "local": {
      if (!config.localBaseUrl) {
        throw new Error("LOCAL_AI_BASE_URL is required when AI_PROVIDER=local");
      }
      return new LocalModelProvider({
        baseUrl: config.localBaseUrl,
        model: config.localModel ?? "llama3.1",
      });
    }
    default:
      return new MockProvider();
  }
}