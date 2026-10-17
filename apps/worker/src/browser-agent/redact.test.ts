import { describe, expect, it } from "vitest";
import { scrubForAgent } from "./redact";

describe("scrubForAgent", () => {
  it("keeps structural text", () => {
    expect(scrubForAgent("Sign in to your account", [], 100)).toBe("Sign in to your account");
  });

  it("replaces known secrets before truncating, so no prefix leaks", () => {
    const out = scrubForAgent("token: abcdef123456", ["abcdef123456"], 12);
    expect(out).toBe("token: [reda");
    expect(out).not.toContain("abc");
  });

  it("withholds emails and long digit runs but keeps the words around them", () => {
    expect(scrubForAgent("Hi jane@corp.test, card 4111 1111 1111 1111", [], 200)).toBe("Hi [email], card [number]");
  });

  it("ignores trivially short secrets that would shred ordinary words", () => {
    expect(scrubForAgent("Account", ["a"], 100)).toBe("Account");
  });
});
