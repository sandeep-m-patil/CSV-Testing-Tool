import { describe, expect, it } from "vitest";
import { PageAgent, narrowByRole } from "./agent";
import { createFakePage, createScriptedAI } from "./fake-page";
import type { AgentElement } from "./page-elements";

const elements: AgentElement[] = [
  { i: 1, tag: "input", type: "email", label: "E-Mail" },
  { i: 2, tag: "input", type: "password", label: "Passwort" },
  { i: 3, tag: "button", label: "Anmelden" },
  { i: 4, tag: "a", label: "Passwort vergessen?", href: "/reset" },
];

describe("narrowByRole", () => {
  it("keeps only elements compatible with the wanted role", () => {
    expect(narrowByRole(elements, "button").map((element) => element.i)).toEqual([3]);
    expect(narrowByRole(elements, "textbox").map((element) => element.i)).toEqual([1, 2]);
  });

  it("falls back to every element when nothing matches", () => {
    expect(narrowByRole(elements, "checkbox")).toHaveLength(elements.length);
  });
});

describe("PageAgent.findElement", () => {
  it("returns the element the model picks with confidence", async () => {
    const scripted = createScriptedAI([{ ref: 3, confidence: 0.9 }]);
    const found = await new PageAgent(scripted.ai, { secrets: [] }).findElement(createFakePage(elements).page, { intent: "the sign-in button", role: "button" });
    expect(found?.element.label).toBe("Anmelden");
  });

  it("ignores a low-confidence guess", async () => {
    const scripted = createScriptedAI([{ ref: 3, confidence: 0.2 }]);
    await expect(new PageAgent(scripted.ai, { secrets: [] }).findElement(createFakePage(elements).page, { intent: "x" })).resolves.toBeNull();
  });

  it("rejects a ref that was never listed", async () => {
    const scripted = createScriptedAI([{ ref: 99, confidence: 0.99 }]);
    await expect(new PageAgent(scripted.ai, { secrets: [] }).findElement(createFakePage(elements).page, { intent: "x" })).resolves.toBeNull();
  });

  it("only offers role-compatible candidates to the model", async () => {
    const scripted = createScriptedAI([{ ref: 1, confidence: 0.9 }]);
    await new PageAgent(scripted.ai, { secrets: [] }).findElement(createFakePage(elements).page, { intent: "the email field", role: "textbox" });
    expect(scripted.requests[0]?.page.elements.map((element) => element.i)).toEqual([1, 2]);
  });

  it("never sends known secrets or personal data on the page", async () => {
    const scripted = createScriptedAI([{ ref: 3, confidence: 0.9 }]);
    const page = createFakePage(
      [...elements, { i: 5, tag: "a", label: "Signed in as jane@corp.test" }],
      "Welcome jane@corp.test, your code is hunter22 and card 4111 1111 1111 1111",
    ).page;
    await new PageAgent(scripted.ai, { secrets: ["hunter22"] }).findElement(page, { intent: "the sign-in button" });
    const sent = JSON.stringify(scripted.requests);
    expect(sent).not.toContain("hunter22");
    expect(sent).not.toContain("jane@corp.test");
    expect(sent).not.toContain("4111 1111");
  });
});

describe("PageAgent yes/no checks", () => {
  it("treats an unsure 'yes' as no", async () => {
    const agent = new PageAgent(createScriptedAI([{ answer: true, confidence: 0.3 }]).ai, { secrets: [] });
    await expect(agent.isIrreversible(createFakePage(elements).page, "Approve result")).resolves.toBe(false);
  });

  it("accepts a confident 'yes'", async () => {
    const agent = new PageAgent(createScriptedAI([{ answer: true, confidence: 0.9 }]).ai, { secrets: [] });
    await expect(agent.isIrreversible(createFakePage(elements).page, "Place order")).resolves.toBe(true);
  });
});
