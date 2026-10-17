import { describe, expect, it } from "vitest";
import { moduleIdOfKey } from "./evidence-key";

const MODULE_ID = "6f1c2d3e-4b5a-4c6d-8e7f-001122334455";

describe("moduleIdOfKey", () => {
  it("reads the owning module from run and discovery evidence keys", () => {
    expect(moduleIdOfKey(`modules/${MODULE_ID}/runs/r1/login.png`)).toBe(MODULE_ID);
    expect(moduleIdOfKey(`modules/${MODULE_ID}/sessions/s1/step-1.png`)).toBe(MODULE_ID);
  });

  it("rejects keys that are not evidence, so they are never served", () => {
    expect(moduleIdOfKey("uploads/secret.txt")).toBeNull();
    expect(moduleIdOfKey("modules/not-a-uuid/runs/x.png")).toBeNull();
    expect(moduleIdOfKey(`../modules/${MODULE_ID}/x.png`)).toBeNull();
  });
});

describe("evidenceUrl", () => {
  it("always routes through the authorized proxy, never the bucket", async () => {
    const { evidenceUrl } = await import("./evidence-key");
    expect(evidenceUrl("modules/m1/runs/r1/login case-a1-s2.png")).toBe("/api/storage/modules/m1/runs/r1/login%20case-a1-s2.png");
  });
});
