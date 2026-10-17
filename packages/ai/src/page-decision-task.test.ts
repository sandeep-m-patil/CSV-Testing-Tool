import { describe, expect, it } from "vitest";
import type { AiPageDecisionInput } from "@repo/schemas";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { buildPageDecisionTask, parsePageDecision } from "./page-decision-task";

const input: AiPageDecisionInput = {
  task: "goal_step",
  instruction: "Sign in",
  page: { url: "https://app.test/login", title: "Login", text: "Sign in", elements: [{ i: 1, tag: "input", type: "password", label: "Password" }] },
  valueKeys: { password: "the account password" },
};

describe("buildPageDecisionTask", () => {
  it("tells the model which task it is answering and what it may output", () => {
    const task = JSON.stringify(buildPageDecisionTask(input));
    expect(task).toContain("browser_agent_goal_step");
    expect(task).toContain("Never output selectors");
  });

  it("rejects an input with more elements than one request may carry", () => {
    const tooMany = { ...input, page: { ...input.page, elements: Array.from({ length: 241 }, (_, i) => ({ i: i + 1, tag: "a" })) } };
    expect(() => buildPageDecisionTask(tooMany)).toThrow();
  });
});

describe("parsePageDecision", () => {
  it("accepts a well-formed decision", () => {
    expect(parsePageDecision({ ref: 1, confidence: 0.8, operation: "TYPE", valueKey: "password" })).toMatchObject({ ref: 1, operation: "TYPE" });
  });

  it("turns a malformed reply into 'no decision' instead of throwing", () => {
    expect(parsePageDecision({ ref: "one", operation: "HACK" })).toEqual({ ref: null, answer: false, confidence: 0 });
  });
});

describe("decidePageAction", () => {
  it("Gemini sends the decision task and returns a validated decision", async () => {
    let sent = "";
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      const text = JSON.stringify({ ref: 1, confidence: 0.9, operation: "TYPE", valueKey: "password" });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const decision = await new GeminiProvider({ apiKey: "k", model: "m", fetcher }).decidePageAction(input);
    expect(decision).toMatchObject({ ref: 1, operation: "TYPE", valueKey: "password" });
    expect(sent).toContain("browser_agent_goal_step");
  });

  it("the mock provider never decides, so the agent stays off", async () => {
    await expect(new MockProvider().decidePageAction()).resolves.toMatchObject({ confidence: 0 });
  });
});
