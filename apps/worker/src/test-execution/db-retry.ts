/**
 * Retries a database write on transient connection faults. Managed Postgres
 * poolers (Neon) occasionally reset idle TLS connections; one reset must not
 * abort a run whose browser work already finished and whose evidence exists.
 */

const TRANSIENT = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|CONNECTION_CLOSED|CONNECTION_ENDED|connection terminated|Connection terminated/i;
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 250;

export function isTransientDbError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  return TRANSIENT.test(code) || TRANSIENT.test(error instanceof Error ? error.message : String(error));
}

export async function withDbRetry<T>(operation: () => Promise<T>, delayMs: number = BASE_DELAY_MS): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDbError(error) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (attempt - 1)));
    }
  }
}
