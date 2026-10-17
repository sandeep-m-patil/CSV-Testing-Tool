import type { Page } from "playwright";
import type { AIProvider } from "@repo/ai";
import type { AiPageDecision, AiPageDecisionInput } from "@repo/schemas";
import type { AgentElement } from "./page-elements";

/**
 * Test doubles for the browser agent: a Playwright page that serves a fixed
 * element list and records actions, and an AI provider that replays scripted
 * decisions and captures every request it was sent.
 */

export interface RecordedAction {
  selector: string;
  action: "fill" | "click" | "press" | "select";
  value?: string;
}

export interface FakePage {
  page: Page;
  actions: RecordedAction[];
}

export function createFakePage(elements: AgentElement[], text = ""): FakePage {
  const state = { elements, text };
  const actions: RecordedAction[] = [];
  const locator = (selector: string) => {
    const handle = {
      first: () => handle,
      isVisible: async () => true,
      fill: async (value: string) => void actions.push({ selector, action: "fill", value }),
      click: async () => void actions.push({ selector, action: "click" }),
      press: async (value: string) => void actions.push({ selector, action: "press", value }),
      selectOption: async (value: unknown) => void actions.push({ selector, action: "select", value: JSON.stringify(value) }),
    };
    return handle;
  };
  const page = {
    url: () => "https://app.test/login",
    title: async () => "Anmelden",
    // Helper installation calls return nothing; the enumeration call returns the elements.
    evaluate: async (_fn: unknown, arg?: { attribute?: string }) => (arg?.attribute ? state : undefined),
    locator,
    waitForLoadState: async () => undefined,
    waitForTimeout: async () => undefined,
    mouse: { wheel: async () => undefined },
  };
  return { page: page as unknown as Page, actions };
}

export interface ScriptedAI {
  ai: AIProvider;
  requests: AiPageDecisionInput[];
}

/** Replays `script` in order; the last entry repeats once the script runs out. */
export function createScriptedAI(script: Array<Partial<AiPageDecision>>): ScriptedAI {
  const requests: AiPageDecisionInput[] = [];
  let call = 0;
  const ai = {
    kind: "gemini",
    label: "Gemini (test)",
    decidePageAction: async (input: AiPageDecisionInput) => {
      requests.push(input);
      const next = script[Math.min(call, script.length - 1)] ?? {};
      call += 1;
      return { ref: null, answer: false, confidence: 0, ...next };
    },
  };
  return { ai: ai as unknown as AIProvider, requests };
}
