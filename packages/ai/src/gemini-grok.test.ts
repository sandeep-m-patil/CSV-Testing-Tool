import { describe, expect, it, vi } from "vitest";
import { createAIProvider } from "./factory";
import { GeminiProvider } from "./gemini";
import { GrokProvider, GROK_DEFAULT_BASE_URL } from "./grok";
import { OpenAICompatibleProvider } from "./openai";
import { MockProvider } from "./mock";
import type { AiPageContext } from "@repo/schemas";

const pageContext: AiPageContext = {
  url: "https://app.test/materials",
  title: "Materials",
  elements: [{ elementType: "textbox", label: "Search" }, { elementType: "button", text: "Add" }],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("createAIProvider", () => {
  it("defaults to the deterministic mock provider", () => {
    expect(createAIProvider({ provider: "mock" })).toBeInstanceOf(MockProvider);
  });

  it("builds a Gemini provider", () => {
    const provider = createAIProvider({ provider: "gemini", geminiApiKey: "k" });
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.kind).toBe("gemini");
  });

  it("requires a Gemini key", () => {
    expect(() => createAIProvider({ provider: "gemini" })).toThrow(/GEMINI_API_KEY/);
  });

  it("builds a Grok provider", () => {
    const provider = createAIProvider({ provider: "grok", xaiApiKey: "k" });
    expect(provider).toBeInstanceOf(GrokProvider);
    expect(provider.kind).toBe("grok");
  });

  it("requires an xAI key", () => {
    expect(() => createAIProvider({ provider: "grok" })).toThrow(/XAI_API_KEY/);
  });

  it("builds an OpenAI provider", () => {
    expect(createAIProvider({ provider: "openai", openaiApiKey: "k" })).toBeInstanceOf(OpenAICompatibleProvider);
  });
});

describe("GeminiProvider", () => {
  it("calls generateContent and schema-validates the reply", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    pageType: "list",
                    purpose: "Browse materials.",
                    fields: [],
                    actions: [{ name: "Add", type: "create" }],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    const provider = new GeminiProvider({ apiKey: "secret", model: "gemini-2.5-flash", fetcher });

    const result = await provider.interpretPage(pageContext);

    expect(result.pageType).toBe("list");
    expect(result.actions[0]?.type).toBe("create");

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("secret");
    expect(String(init.body)).toContain("interpret_page");
  });

  it("surfaces an HTTP error with the status code", async () => {
    const fetcher = vi.fn(async () => new Response("quota exceeded", { status: 429 }));
    const provider = new GeminiProvider({ apiKey: "secret", model: "m", fetcher });
    await expect(provider.interpretPage(pageContext)).rejects.toThrow(/Gemini error 429/);
  });

  it("rejects a reply that fails schema validation", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pageType: "not-a-real-type" }) }] } }] }),
    );
    const provider = new GeminiProvider({ apiKey: "secret", model: "m", fetcher });
    await expect(provider.interpretPage(pageContext)).rejects.toThrow();
  });
});

describe("GrokProvider", () => {
  it("uses the xAI OpenAI-compatible endpoint by default", () => {
    expect(GROK_DEFAULT_BASE_URL).toBe("https://api.x.ai/v1");
  });

  it("calls chat/completions and schema-validates the reply", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: JSON.stringify({ pageType: "list", purpose: "Browse.", fields: [], actions: [] }) } }] }),
    );
    const provider = new GrokProvider({ apiKey: "secret", model: "grok-4.6", fetcher });

    const result = await provider.interpretPage(pageContext);

    expect(result.pageType).toBe("list");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GROK_DEFAULT_BASE_URL}/chat/completions`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret");
  });

  it("sends only the structured page context, never credential material", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: JSON.stringify({ pageType: "other", purpose: "p", fields: [], actions: [] }) } }] }),
    );
    const provider = new GrokProvider({ apiKey: "secret", model: "grok-4.6", fetcher });
    await provider.interpretPage({
      ...pageContext,
      title: "My account",
      elements: [
        { elementType: "textbox", label: "Email", name: "user_hunter2_password" },
        { elementType: "button", text: "Sign in" },
      ],
    });

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ content: string }>;
    };
    const payload = JSON.parse(body.messages[1]!.content) as { page: { elements: unknown[] } };
    // The task payload carries the page snapshot and nothing else.
    expect(Object.keys(payload.page)).toEqual(["url", "title", "elements"]);
    expect(body.messages[0]!.content).toContain("Never emit Playwright code");
  });

  it("redacts credential-shaped attribute values before sending", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: JSON.stringify({ pageType: "other", purpose: "p", fields: [], actions: [] }) } }] }),
    );
    const provider = new GrokProvider({ apiKey: "k", model: "grok-4.6", fetcher });
    await provider.interpretPage({
      url: "https://app.test/login",
      title: "Sign in",
      elements: [
        { elementType: "textbox", name: "user_hunter2_password", placeholder: "Employee code" },
        { elementType: "textbox", label: "Email", placeholder: "you@example.com" },
        { elementType: "button", text: "Sign in" },
      ],
    });

    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> };
    const sent = body.messages[1]!.content;

    expect(sent).not.toMatch(/hunter2/);
    expect(sent).not.toMatch(/you@example\.com/);
    expect(sent).toContain("[redacted]");
    // Structure survives redaction so the model can still reason about the page.
    expect(sent).toContain("Employee code");
    expect(sent).toContain("textbox");
  });
});