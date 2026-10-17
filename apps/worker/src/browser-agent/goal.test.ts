import { describe, expect, it } from "vitest";
import { PageAgent } from "./agent";
import { createFakePage, createScriptedAI } from "./fake-page";
import { runGoal } from "./goal";
import { loginWithAgent } from "./login";
import type { AgentElement } from "./page-elements";

const form: AgentElement[] = [
  { i: 1, tag: "input", type: "tel", label: "Telefonnummer" },
  { i: 2, tag: "input", type: "password", label: "Passwort" },
  { i: 3, tag: "button", label: "Weiter" },
  { i: 4, tag: "select", label: "Test type", options: ["Chemistry", "Hematology"] },
];
const credential = { username: "+4915112345678", password: "s3cret-pass" };

describe("loginWithAgent", () => {
  it("types each credential by name, submits, and reports done", async () => {
    const scripted = createScriptedAI([
      { operation: "TYPE", ref: 1, valueKey: "username", confidence: 0.9 },
      { operation: "TYPE", ref: 2, valueKey: "password", confidence: 0.9 },
      { operation: "CLICK", ref: 3, confidence: 0.9 },
      { operation: "DONE", confidence: 0.9 },
    ]);
    const fake = createFakePage(form);
    const result = await loginWithAgent(new PageAgent(scripted.ai, { secrets: [credential.username, credential.password] }), fake.page, credential);
    expect(result.status).toBe("done");
    expect(fake.actions.map((action) => [action.action, action.value])).toEqual([
      ["fill", credential.username],
      ["fill", credential.password],
      ["click", undefined],
    ]);
  });

  it("offers credentials to the model by name only, never by value", async () => {
    const scripted = createScriptedAI([{ operation: "TYPE", ref: 1, valueKey: "username", confidence: 0.9 }, { operation: "DONE", confidence: 0.9 }]);
    await loginWithAgent(new PageAgent(scripted.ai, { secrets: [credential.username, credential.password] }), createFakePage(form).page, credential);
    const sent = JSON.stringify(scripted.requests);
    expect(sent).not.toContain(credential.password);
    expect(sent).not.toContain(credential.username);
    expect(scripted.requests[0]?.valueKeys).toHaveProperty("password");
  });
});

describe("runGoal", () => {
  it("reports an error the page shows after an action", async () => {
    const scripted = createScriptedAI([{ operation: "CLICK", ref: 3, confidence: 0.9 }, { operation: "ERROR", confidence: 0.9 }]);
    const result = await runGoal(new PageAgent(scripted.ai, { secrets: [] }), createFakePage(form).page, { goal: "Submit" });
    expect(result.status).toBe("error");
  });

  it("stops instead of repeating the same action forever", async () => {
    const scripted = createScriptedAI([{ operation: "CLICK", ref: 3, confidence: 0.9 }]);
    const result = await runGoal(new PageAgent(scripted.ai, { secrets: [] }), createFakePage(form).page, { goal: "Submit" });
    expect(result.status).toBe("stuck");
  });

  it("does nothing on a low-confidence decision", async () => {
    const scripted = createScriptedAI([{ operation: "CLICK", ref: 3, confidence: 0.1 }]);
    const fake = createFakePage(form);
    const result = await runGoal(new PageAgent(scripted.ai, { secrets: [] }), fake.page, { goal: "Submit" });
    expect(result.status).toBe("stuck");
    expect(fake.actions).toHaveLength(0);
  });

  it("does not trust 'done' on the untouched first page unless certain", async () => {
    const scripted = createScriptedAI([{ operation: "DONE", confidence: 0.6 }]);
    const result = await runGoal(new PageAgent(scripted.ai, { secrets: [] }), createFakePage(form).page, { goal: "Register a sample" });
    expect(result.status).toBe("stuck");
  });

  it("selects a dropdown option and types literal test data", async () => {
    const scripted = createScriptedAI([
      { operation: "SELECT", ref: 4, option: "Chemistry", confidence: 0.9 },
      { operation: "TYPE", ref: 1, text: "S-1001", confidence: 0.9 },
      { operation: "DONE", confidence: 0.9 },
    ]);
    const fake = createFakePage(form);
    const result = await runGoal(new PageAgent(scripted.ai, { secrets: [] }), fake.page, { goal: "Register sample S-1001 for Chemistry" });
    expect(result.status).toBe("done");
    expect(fake.actions.map((action) => action.action)).toEqual(["select", "fill"]);
    expect(fake.actions[1]?.value).toBe("S-1001");
  });
});
