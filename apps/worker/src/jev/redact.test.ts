import { describe, expect, it } from "vitest";
import { scrubForJev } from "./redact";

describe("scrubForJev", () => {
  it("keeps structural text", () => {
    expect(scrubForJev("Sign in to your account", [], 100)).toBe("Sign in to your account");
  });

  it("replaces known secrets before truncating, so no prefix leaks", () => {
    const out = scrubForJev("token: abcdef123456", ["abcdef123456"], 12);
    expect(out).toBe("token: [reda");
    expect(out).not.toContain("abc");
  });

  it("withholds emails and long digit runs but keeps the words around them", () => {
    expect(scrubForJev("Hi jane@corp.test, card 4111 1111 1111 1111", [], 200)).toBe("Hi [email], card [number]");
  });

  it("ignores trivially short secrets that would shred ordinary words", () => {
    expect(scrubForJev("Account", ["a"], 100)).toBe("Account");
  });
});
