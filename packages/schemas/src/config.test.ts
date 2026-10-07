import { describe, expect, it } from "vitest";
import { CredentialVariablesSchema, EnvironmentInputSchema } from "./config";

describe("CredentialVariablesSchema", () => {
  it("accepts token-safe names", () => {
    expect(CredentialVariablesSchema.safeParse({ lab_id: "LAB-01", Tenant2: "x" }).success).toBe(true);
  });

  it("rejects names that cannot be used as {{tokens}}", () => {
    expect(CredentialVariablesSchema.safeParse({ "lab id": "x" }).success).toBe(false);
  });

  it("reserves the credential tokens", () => {
    expect(CredentialVariablesSchema.safeParse({ password: "x" }).success).toBe(false);
  });
});

describe("EnvironmentInputSchema", () => {
  it("requires a full URL", () => {
    expect(EnvironmentInputSchema.safeParse({ name: "QA", baseUrl: "qa.example.com" }).success).toBe(false);
    expect(EnvironmentInputSchema.safeParse({ name: "QA", baseUrl: "https://qa.example.com" }).success).toBe(true);
  });
});
