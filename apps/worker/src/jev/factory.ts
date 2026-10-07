import { createJevClient } from "@repo/ai";
import type { WorkerEnv } from "../env";
import { JevAgent } from "./agent";

/**
 * Builds the Jev agent for one run, or null when no key is configured.
 * `secrets` are every credential value the run may type; they are scrubbed out
 * of anything sent to Jev.
 */
export function createJevAgent(workerEnv: WorkerEnv, secrets: readonly string[]): JevAgent | null {
  const client = createJevClient({
    apiKey: workerEnv.TYPESAFE_API_KEY,
    apiUrl: workerEnv.JEV_API_URL,
    model: workerEnv.JEV_MODEL,
  });
  return client ? new JevAgent(client, { secrets }) : null;
}
