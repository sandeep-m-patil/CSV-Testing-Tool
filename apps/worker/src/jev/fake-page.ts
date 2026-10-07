import type { Page } from "playwright";
import { JevClient, type JevAnswers } from "@repo/ai";
import type { JevElement } from "./page-elements";

/**
 * Test doubles for the Jev agent: a Playwright page that serves a fixed
 * element list and records actions, and a Jev client whose HTTP layer replays
 * scripted answers and captures every request body.
 */

export interface RecordedAction {
  selector: string;
  action: "fill" | "click" | "press";
  value?: string;
}

export interface FakePage {
  page: Page;
  actions: RecordedAction[];
  setElements(elements: JevElement[], text?: string): void;
}

export function createFakePage(initial: JevElement[], text = ""): FakePage {
  let state = { elements: initial, text };
  const actions: RecordedAction[] = [];
  const locator = (selector: string) => {
    const handle = {
      first: () => handle,
      isVisible: async () => true,
      fill: async (value: string) => void actions.push({ selector, action: "fill", value }),
      click: async () => void actions.push({ selector, action: "click" }),
      press: async (value: string) => void actions.push({ selector, action: "press", value }),
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
  };
  return {
    page: page as unknown as Page,
    actions,
    setElements: (elements, nextText = "") => {
      state = { elements, text: nextText };
    },
  };
}

export interface ScriptedJev {
  client: JevClient;
  requests: Array<{ state: unknown; questions: Record<string, unknown> }>;
  rawBodies: string[];
}

/** Replays `script` in order; the last entry repeats once the script runs out. */
export function createScriptedJev(script: JevAnswers[]): ScriptedJev {
  const requests: ScriptedJev["requests"] = [];
  const rawBodies: string[] = [];
  let call = 0;
  const fetcher = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = String(init?.body ?? "");
    rawBodies.push(body);
    requests.push(JSON.parse(body) as ScriptedJev["requests"][number]);
    const answers = script[Math.min(call, script.length - 1)];
    call += 1;
    return new Response(JSON.stringify({ answers }), { status: 200 });
  }) as typeof fetch;
  return { client: new JevClient({ apiKey: "test-key", fetcher, retries: 0 }), requests, rawBodies };
}

export function noul(probability: number): { noul: number } {
  return { noul: probability };
}

export function choice(picked: string, probability: number): { choice: string; probabilities: Record<string, number> } {
  return { choice: picked, probabilities: { [picked]: probability } };
}
