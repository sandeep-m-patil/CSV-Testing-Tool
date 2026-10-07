import { describe, expect, it } from "vitest";
import { JevAgent } from "../jev/agent";
import { choice, createFakePage, createScriptedJev, noul } from "../jev/fake-page";
import { createJevResolver } from "./semantic-target";

const page = () => createFakePage([{ i: 1, tag: "button", label: "Sign in" }]).page;

describe("createJevResolver", () => {
  it("is disabled without an agent, and resolves nothing", async () => {
    const resolver = createJevResolver(null);
    expect(resolver.isEnabled()).toBe(false);
    await expect(resolver.resolve(page(), { intent: "the Sign in button" })).resolves.toBeNull();
  });

  it("returns the locator Jev picked", async () => {
    const jev = createScriptedJev([{ present: noul(0.9), target: choice("1", 0.9) }]);
    const resolver = createJevResolver(new JevAgent(jev.client, { secrets: [] }));
    expect(resolver.isEnabled()).toBe(true);
    await expect(resolver.resolve(page(), { intent: "the Sign in button", role: "button" })).resolves.not.toBeNull();
  });

  it("turns a Jev outage into a miss rather than a test failure", async () => {
    const failing = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
    const { JevClient } = await import("@repo/ai");
    const agent = new JevAgent(new JevClient({ apiKey: "k", fetcher: failing, retries: 0 }), { secrets: [] });
    const messages: string[] = [];
    const resolver = createJevResolver(agent, (message) => messages.push(message));
    await expect(resolver.resolve(page(), { intent: "the Sign in button" })).resolves.toBeNull();
    expect(messages[0]).toMatch(/Jev error 503/);
  });
});
