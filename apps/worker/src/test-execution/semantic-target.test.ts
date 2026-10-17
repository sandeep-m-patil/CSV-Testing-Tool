import { describe, expect, it } from "vitest";
import type { AIProvider } from "@repo/ai";
import { PageAgent } from "../browser-agent/agent";
import { createFakePage, createScriptedAI } from "../browser-agent/fake-page";
import { createAgentResolver } from "./semantic-target";

const page = () => createFakePage([{ i: 1, tag: "button", label: "Sign in" }]).page;

describe("createAgentResolver", () => {
  it("is disabled without an agent, and resolves nothing", async () => {
    const resolver = createAgentResolver(null);
    expect(resolver.isEnabled()).toBe(false);
    await expect(resolver.resolve(page(), { intent: "the Sign in button" })).resolves.toBeNull();
  });

  it("returns the locator the model picked", async () => {
    const resolver = createAgentResolver(new PageAgent(createScriptedAI([{ ref: 1, confidence: 0.9 }]).ai, { secrets: [] }));
    expect(resolver.isEnabled()).toBe(true);
    await expect(resolver.resolve(page(), { intent: "the Sign in button", role: "button" })).resolves.not.toBeNull();
  });

  it("turns an AI outage into a miss rather than a test failure", async () => {
    const failing = { kind: "gemini", label: "Gemini", decidePageAction: async () => Promise.reject(new Error("Gemini error 503")) } as unknown as AIProvider;
    const messages: string[] = [];
    const resolver = createAgentResolver(new PageAgent(failing, { secrets: [] }), (message) => messages.push(message));
    await expect(resolver.resolve(page(), { intent: "the Sign in button" })).resolves.toBeNull();
    expect(messages[0]).toMatch(/Gemini error 503/);
  });
});
