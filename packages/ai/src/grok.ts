import { OpenAICompatibleProvider } from "./openai";

export interface GrokOptions {
  apiKey: string;
  model: string;
  /** Overridable for a proxy or a regional xAI endpoint. */
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export const GROK_DEFAULT_BASE_URL = "https://api.x.ai/v1";
export const GROK_DEFAULT_MODEL = "grok-4.6";

/**
 * xAI's Grok, reached over its OpenAI-compatible endpoint. Same contract and
 * same redaction boundary as every other provider: Grok decides *what should
 * be tested*, never whether a test passed, and never emits Playwright code.
 */
export class GrokProvider extends OpenAICompatibleProvider {
  constructor(options: GrokOptions) {
    super({
      kind: "grok",
      label: `Grok (${options.model})`,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? GROK_DEFAULT_BASE_URL,
      model: options.model,
      fetcher: options.fetcher,
    });
  }
}