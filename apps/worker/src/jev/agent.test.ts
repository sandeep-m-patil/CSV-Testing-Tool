import { describe, expect, it } from "vitest";
import { JevAgent, narrowByRole } from "./agent";
import { choice, createFakePage, createScriptedJev, noul } from "./fake-page";
import type { JevElement } from "./page-elements";

const elements: JevElement[] = [
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

describe("JevAgent.findElement", () => {
  it("returns the element Jev picks when it is confident", async () => {
    const jev = createScriptedJev([{ present: noul(0.95), target: choice("3", 0.9) }]);
    const agent = new JevAgent(jev.client, { secrets: [] });
    const found = await agent.findElement(createFakePage(elements).page, { intent: "the sign-in button", role: "button" });
    expect(found?.element.label).toBe("Anmelden");
  });

  it("returns null when Jev's pick is a low-confidence guess", async () => {
    const jev = createScriptedJev([{ present: noul(0.9), target: choice("3", 0.1) }]);
    const agent = new JevAgent(jev.client, { secrets: [] });
    await expect(agent.findElement(createFakePage(elements).page, { intent: "the sign-in button" })).resolves.toBeNull();
  });

  it("returns null when Jev says the element is not on the page", async () => {
    const jev = createScriptedJev([{ present: noul(0.1), target: choice("3", 0.9) }]);
    const agent = new JevAgent(jev.client, { secrets: [] });
    await expect(agent.findElement(createFakePage(elements).page, { intent: "the checkout button" })).resolves.toBeNull();
  });

  it("only offers role-compatible candidates to Jev", async () => {
    const jev = createScriptedJev([{ present: noul(0.9), target: choice("1", 0.9) }]);
    const agent = new JevAgent(jev.client, { secrets: [] });
    await agent.findElement(createFakePage(elements).page, { intent: "the email field", role: "textbox" });
    const criteria = (jev.requests[0]?.questions.target as { criteria: Record<string, null> }).criteria;
    expect(Object.keys(criteria)).toEqual(["1", "2"]);
  });

  it("never sends known secrets or emails visible on the page", async () => {
    const jev = createScriptedJev([{ present: noul(0.9), target: choice("3", 0.9) }]);
    const agent = new JevAgent(jev.client, { secrets: ["hunter22"] });
    const page = createFakePage(
      [...elements, { i: 5, tag: "a", label: "Signed in as jane@corp.test" }],
      "Welcome jane@corp.test, your code is hunter22 and card 4111 1111 1111 1111",
    ).page;
    await agent.findElement(page, { intent: "the sign-in button" });
    const body = jev.rawBodies.join("\n");
    expect(body).not.toContain("hunter22");
    expect(body).not.toContain("jane@corp.test");
    expect(body).not.toContain("4111 1111");
  });
});
