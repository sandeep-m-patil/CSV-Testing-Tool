import type { AIProvider } from "@repo/ai";
import { PageAgent } from "./agent";

/**
 * The browser agent for one run, or null when no real model is configured
 * (AI_PROVIDER=mock). `secrets` are every credential value the run may type;
 * they are scrubbed out of anything sent to the model.
 */
export function createPageAgent(ai: AIProvider, secrets: readonly string[]): PageAgent | null {
  return ai.kind === "mock" ? null : new PageAgent(ai, { secrets });
}
