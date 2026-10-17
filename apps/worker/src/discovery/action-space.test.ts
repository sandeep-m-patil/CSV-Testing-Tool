import { describe, expect, it } from "vitest";
import type { DetectedAction } from "@repo/browser";
import { buildActionSpace, decideOneAction, type ActorContext } from "./action-space";
import { buildModuleScope } from "./scope";

const BASE = "https://shop.test/";

function actor(): ActorContext {
  return {
    baseUrl: BASE,
    scope: buildModuleScope({ baseUrl: BASE }),
    moduleName: "Whole site",
    moduleKeywords: [],
    roleUsername: null,
    rolePassword: null,
    testData: [],
    visitedUrls: new Set([BASE]),
    executedKeys: new Set(),
    skippedUrls: new Set(),
    onLoginPage: false,
    fillCount: 0,
    navigationDepth: 0,
    navigationDepthBudget: 3,
    loginChecks: new Map(),
    isAgentLoginAttempted: false,
  };
}

function action(kind: DetectedAction["action"], text: string, url?: string): DetectedAction {
  return { action: kind, target: { elementType: url ? "link" : "button", text, url, cssSelector: `#${text.replace(/\W/g, "")}` }, dangerous: false, blocked: false };
}

describe("decideOneAction", () => {
  it("follows an unvisited link before pressing an arbitrary button", () => {
    const space = buildActionSpace([], [action("CLICK", "Menu"), action("NAVIGATE", "Outerwear", `${BASE}list/outerwear`)]);
    expect(decideOneAction(space, actor()).kind).toBe("navigate");
  });

  it("still presses a button whose caption says it submits", () => {
    const space = buildActionSpace([], [action("CLICK", "Save"), action("NAVIGATE", "Outerwear", `${BASE}list/outerwear`)]);
    expect(decideOneAction(space, actor()).kind).toBe("submit-form");
  });

  it("skips an in-page anchor to the page already being explored", () => {
    const space = buildActionSpace([], [action("NAVIGATE", "News", `${BASE}#news`)]);
    expect(decideOneAction(space, actor()).kind).toBe("none");
  });
});
