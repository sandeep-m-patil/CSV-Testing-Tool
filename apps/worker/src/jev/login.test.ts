import { describe, expect, it } from "vitest";
import { JevAgent } from "./agent";
import { choice, createFakePage, createScriptedJev, noul } from "./fake-page";
import { loginWithJev } from "./login";
import type { JevElement } from "./page-elements";

const form: JevElement[] = [
  { i: 1, tag: "input", type: "tel", label: "Telefonnummer" },
  { i: 2, tag: "input", type: "password", label: "Passwort" },
  { i: 3, tag: "button", label: "Weiter" },
];
const credential = { username: "+4915112345678", password: "s3cret-pass" };

function round(overrides: Record<string, unknown>) {
  return { done: noul(0.05), error: noul(0.02), blocked: noul(0.01), tool: choice("type", 0.9), value: choice("username", 0.9), target: choice("1", 0.9), ...overrides };
}

describe("loginWithJev", () => {
  it("types each credential, submits, and reports done", async () => {
    const jev = createScriptedJev([
      round({}),
      round({ value: choice("password", 0.9), target: choice("2", 0.9) }),
      round({ tool: choice("click", 0.9), target: choice("3", 0.9) }),
      round({ done: noul(0.95), tool: choice("none", 0.9) }),
    ]);
    const fake = createFakePage(form);
    const result = await loginWithJev(new JevAgent(jev.client, { secrets: [credential.username, credential.password] }), fake.page, credential);

    expect(result.status).toBe("done");
    expect(fake.actions.map((action) => action.action)).toEqual(["fill", "fill", "click"]);
    expect(fake.actions[0]?.value).toBe(credential.username);
    expect(fake.actions[1]?.value).toBe(credential.password);
  });

  it("never sends the credential values to Jev", async () => {
    const jev = createScriptedJev([round({}), round({ done: noul(0.95) })]);
    await loginWithJev(new JevAgent(jev.client, { secrets: [credential.username, credential.password] }), createFakePage(form).page, credential);
    const body = jev.rawBodies.join("\n");
    expect(body).not.toContain(credential.password);
    expect(body).not.toContain(credential.username);
  });

  it("reports an error the page shows after an attempt", async () => {
    const jev = createScriptedJev([round({}), round({ error: noul(0.9) })]);
    const result = await loginWithJev(new JevAgent(jev.client, { secrets: [] }), createFakePage(form).page, credential);
    expect(result.status).toBe("error");
  });

  it("stops instead of repeating the same action forever", async () => {
    const jev = createScriptedJev([round({ tool: choice("click", 0.9), target: choice("3", 0.9) })]);
    const result = await loginWithJev(new JevAgent(jev.client, { secrets: [] }), createFakePage(form).page, credential);
    expect(result.status).toBe("stuck");
  });

  it("gives up when Jev cannot pick a target with confidence", async () => {
    const jev = createScriptedJev([round({ target: choice("1", 0.1) })]);
    const fake = createFakePage(form);
    const result = await loginWithJev(new JevAgent(jev.client, { secrets: [] }), fake.page, credential);
    expect(result.status).toBe("stuck");
    expect(fake.actions).toHaveLength(0);
  });
});
