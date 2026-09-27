import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestContextValue {
  correlationId: string;
  headers: Record<string, string>;
}

export class RequestContext {
  static readonly storage = new AsyncLocalStorage<RequestContextValue>();

  static run<T>(headers: Record<string, string>, fn: () => T): T {
    const incoming = headers["x-correlation-id"];
    const correlationId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    return this.storage.run({ correlationId, headers: { ...headers } }, fn);
  }

  static correlationId(): string {
    return this.storage.getStore()?.correlationId ?? "no-context";
  }

  static header(name: string): string | undefined {
    return this.storage.getStore()?.headers[name.toLowerCase()];
  }
}