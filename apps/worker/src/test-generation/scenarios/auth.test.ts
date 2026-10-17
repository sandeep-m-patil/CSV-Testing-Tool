import { describe, expect, it } from "vitest";
import { buildAuthScenarios } from "./auth";

const PAGE = "https://shop.test/login";

function valuesOf(name: string, credential?: { username: string; password: string }): string[] {
  const found = buildAuthScenarios(PAGE, credential).find((generated) => generated.name === name);
  return (found?.steps ?? []).filter((step) => step.action === "FILL").map((step) => step.value ?? "");
}

describe("buildAuthScenarios", () => {
  it("leaves the successful login to the stored account when the module has none", () => {
    // Tokens without a credential make the executor report BLOCKED, not a false FAIL.
    expect(valuesOf("Login with valid credentials")).toEqual(["{{username}}", "{{password}}"]);
  });

  it("keeps literal placeholders for cases whose outcome does not depend on the account", () => {
    expect(valuesOf("Valid email with invalid password")[1]).toBe("Wr0ngPass!999");
  });

  it("uses tokens for the stored account when there is one", () => {
    expect(valuesOf("Login with valid credentials", { username: "qa@shop.test", password: "s3cret" })).toEqual(["{{username}}", "{{password}}"]);
  });
});
