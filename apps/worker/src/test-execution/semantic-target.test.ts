import { describe, expect, it } from "vitest";
import { isJevConfigured, redactForAgent, createJevResolver } from "./semantic-target";

describe("redactForAgent", () => {
  it("keeps structural text", () => {
    expect(redactForAgent("Sign in button")).toBe("Sign in button");
  });

  it("withholds email addresses", () => {
    expect(redactForAgent("Signed in as jane.doe@example.com")).toBe("[redacted]");
  });

  it("withholds secret-shaped field names", () => {
    expect(redactForAgent("api_key")).toBe("[redacted]");
    expect(redactForAgent("Enter your password")).toBe("[redacted]");
  });

  it("truncates long page text", () => {
    expect(redactForAgent("x".repeat(500))).toHaveLength(200);
  });
});

describe("isJevConfigured", () => {
  it("requires api key, base url and text model key", () => {
    expect(isJevConfigured({})).toBe(false);
    expect(isJevConfigured({ apiKey: "a", baseUrl: "http://x", textModelApiKey: undefined })).toBe(false);
    expect(isJevConfigured({ apiKey: "a", baseUrl: "http://x", textModelApiKey: "b" })).toBe(true);
  });
});

describe("createJevResolver", () => {
  const config = { apiKey: "key", baseUrl: "https://jev.test", textModel: "model" };

  it("is disabled when unconfigured", async () => {
    const resolver = createJevResolver({ apiKey: "key" });
    expect(resolver.isEnabled()).toBe(false);
  });

  it("reports a miss when the agent is unreachable", async () => {
    const resolver = createJevResolver({ ...config, baseUrl: "https://jev.invalid" });
    const page = { url: () => "https://shop.test", title: async () => "Shop" } as never;
    await expect(resolver.resolve(page, { intent: "the Sign in button" })).resolves.toBeNull();
  });

  it("returns null when the agent finds nothing", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ found: false }), { status: 200 })) as never;
    try {
      const resolver = createJevResolver(config);
      const page = { url: () => "https://shop.test", title: async () => "Shop" } as never;
      await expect(resolver.resolve(page, { intent: "the Sign in button" })).resolves.toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("never throws on a non-2xx response", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as never;
    try {
      const resolver = createJevResolver(config);
      const page = { url: () => "https://shop.test", title: async () => "Shop" } as never;
      await expect(resolver.resolve(page, { intent: "the Sign in button" })).resolves.toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
