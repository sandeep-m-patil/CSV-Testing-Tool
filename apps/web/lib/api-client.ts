export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
  });

  // 204 (and HEAD) have no body, and .json() throws synchronously on them.
  const hasBody = response.status !== 204 && response.status !== 205 && response.status !== 304;
  const payload = hasBody ? await readJson(response) : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
    );
  }

  if (payload && "data" in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  return payload as T | null as T;
}

async function readJson(response: Response): Promise<Envelope | null> {
  try {
    return (await response.json()) as Envelope;
  } catch {
    return null;
  }
}

interface Envelope {
  data?: unknown;
  error?: { message?: string; code?: string };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(path: string): string {
  return path;
}