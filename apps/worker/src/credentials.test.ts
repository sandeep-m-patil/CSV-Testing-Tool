import { describe, expect, it } from "vitest";
import { CredentialCrypto } from "@repo/core";
import type { credentials } from "@repo/db/schema";
import { forEnvironment, resolveCredential, secretsOf } from "./credentials";

type Row = typeof credentials.$inferSelect;

const crypto = new CredentialCrypto();
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const LEGACY_MODULE_ID = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<Row>): Row {
  return {
    id: "c1",
    projectId: PROJECT_ID,
    name: "Analyst",
    role: "ANALYST",
    username: "analyst@lab.test",
    environmentId: null,
    variables: {},
    fieldKeys: [],
    formType: "login",
    secretData: crypto.encryptCredentials(PROJECT_ID, "analyst@lab.test", "s3cret"),
    encryptionScope: PROJECT_ID,
    moduleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("resolveCredential", () => {
  it("decrypts a project-scoped secret", () => {
    expect(resolveCredential(row({})).password).toBe("s3cret");
  });

  it("still decrypts a credential migrated from a module, under its original scope", () => {
    const migrated = row({
      secretData: crypto.encryptCredentials(LEGACY_MODULE_ID, "analyst@lab.test", "legacy-pass"),
      encryptionScope: LEGACY_MODULE_ID,
    });
    expect(resolveCredential(migrated).password).toBe("legacy-pass");
  });

  it("treats a seeded placeholder as no secret rather than failing", () => {
    expect(resolveCredential(row({ secretData: `{ "placeholder": "set via UI" }` })).password).toBeNull();
  });

  it("returns no secret when the scope does not match", () => {
    expect(resolveCredential(row({ encryptionScope: LEGACY_MODULE_ID })).password).toBeNull();
  });
});

describe("forEnvironment", () => {
  const anywhere = resolveCredential(row({ id: "any" }));
  const qaOnly = resolveCredential(row({ id: "qa", environmentId: "env-qa" }));
  const prodOnly = resolveCredential(row({ id: "prod", environmentId: "env-prod" }));

  it("keeps credentials pinned to the target environment and unpinned ones", () => {
    expect(forEnvironment([anywhere, qaOnly, prodOnly], "env-qa").map((item) => item.id)).toEqual(["any", "qa"]);
  });

  it("keeps everything when no environment is targeted", () => {
    expect(forEnvironment([anywhere, qaOnly, prodOnly], null)).toHaveLength(3);
  });
});

describe("secretsOf", () => {
  it("lists every username and password to mask", () => {
    expect(secretsOf([resolveCredential(row({}))])).toEqual(["analyst@lab.test", "s3cret"]);
  });
});
