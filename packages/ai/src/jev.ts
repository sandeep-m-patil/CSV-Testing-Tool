import { z } from "zod";

/**
 * Client for TypeSafe System One, the API behind the Jev model.
 *
 * Jev never writes text. It answers typed questions about a JSON `state` with
 * probabilities: yes/no (`noul`) or pick-one-of (`choice`). That makes it a good
 * fit for "which element on this page is X?" at ~300 ms per call, and a poor fit
 * for anything that needs free-form output. Callers turn its probabilities into
 * a Playwright action; Jev itself never emits selectors, code or PASS/FAIL.
 */

export const JEV_DEFAULT_API_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_DEFAULT_MODEL = "jev-latest";
/** System One rejects choice questions with more than 255 options. */
export const JEV_MAX_CHOICES = 240;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 800;
const MAX_ERROR_BODY = 300;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> };

export interface JevClientOptions {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  fetcher?: typeof fetch;
}

const NoulAnswerSchema = z.object({ noul: z.number().min(0).max(1) });
const ChoiceAnswerSchema = z.object({
  choice: z.string(),
  probabilities: z.record(z.number()),
});
const ResponseSchema = z.object({ answers: z.record(z.unknown()) });

export type JevAnswers = Record<string, unknown>;
export interface JevChoice {
  choice: string;
  probabilities: Record<string, number>;
}

class RetryableError extends Error {}

export class JevClient {
  readonly label: string;
  private readonly options: JevClientOptions;

  constructor(options: JevClientOptions) {
    this.options = options;
    this.label = `Jev (${options.model ?? JEV_DEFAULT_MODEL})`;
  }

  /** One request, several questions. Retries 429/5xx and network faults only. */
  async ask(state: unknown, questions: Record<string, JevQuestion>): Promise<JevAnswers> {
    const retries = this.options.retries ?? DEFAULT_RETRIES;
    const delayMs = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.postOnce(state, questions);
      } catch (error) {
        if (!(error instanceof RetryableError) || attempt >= retries) throw error;
        await sleep(delayMs * (attempt + 1));
      }
    }
  }

  private async postOnce(state: unknown, questions: Record<string, JevQuestion>): Promise<JevAnswers> {
    const fetcher = this.options.fetcher ?? fetch;
    let response: Response;
    try {
      response = await fetcher(this.options.apiUrl ?? JEV_DEFAULT_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ state, model: this.options.model ?? JEV_DEFAULT_MODEL, questions }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new RetryableError(`Jev request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, MAX_ERROR_BODY);
      const isRetryable = response.status === HTTP_TOO_MANY_REQUESTS || response.status >= HTTP_SERVER_ERROR;
      const message = `Jev error ${response.status}: ${body}`;
      throw isRetryable ? new RetryableError(message) : new Error(message);
    }
    return ResponseSchema.parse(await response.json()).answers;
  }
}

/** Probability of "yes" for a `noul` question. Throws when the answer is malformed. */
export function readNoul(answers: JevAnswers, name: string): number {
  return NoulAnswerSchema.parse(answers[name]).noul;
}

/** The chosen option and full distribution for a `choice` question. */
export function readChoice(answers: JevAnswers, name: string): JevChoice {
  return ChoiceAnswerSchema.parse(answers[name]);
}

/** Probability Jev assigned to its own choice, 0 when absent. */
export function choiceConfidence(answer: JevChoice): number {
  return answer.probabilities[answer.choice] ?? 0;
}

/** Null when no key is configured, so every caller degrades instead of failing. */
export function createJevClient(config: { apiKey?: string; apiUrl?: string; model?: string }): JevClient | null {
  if (!config.apiKey) return null;
  return new JevClient({ apiKey: config.apiKey, apiUrl: config.apiUrl, model: config.model });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
