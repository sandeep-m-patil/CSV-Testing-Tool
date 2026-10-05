import type { AIProvider, AIProviderKind } from "./types";
import { MockProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai";
import { LocalModelProvider } from "./local";
import { GeminiProvider } from "./gemini";
import { GrokProvider, GROK_DEFAULT_MODEL } from "./grok";

export interface AIProviderConfig {
  provider: AIProviderKind;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  geminiModel?: string;
  xaiApiKey?: string;
  xaiBaseUrl?: string;
  xaiModel?: string;
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
    case "gemini": {
      if (!config.geminiApiKey) {
        throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
      }
      return new GeminiProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel ?? "gemini-2.5-flash",
        baseUrl: config.geminiBaseUrl,
      });
    }
    case "grok": {
      if (!config.xaiApiKey) {
        throw new Error("XAI_API_KEY is required when AI_PROVIDER=grok");
      }
      return new GrokProvider({
        apiKey: config.xaiApiKey,
        model: config.xaiModel ?? GROK_DEFAULT_MODEL,
        baseUrl: config.xaiBaseUrl,
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