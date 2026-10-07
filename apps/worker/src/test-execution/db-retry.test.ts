import { describe, expect, it } from "vitest";
import { isTransientDbError, withDbRetry } from "./db-retry";

describe("withDbRetry", () => {
  it("retries a reset connection and then succeeds", async () => {
    let calls = 0;
    const result = await withDbRetry(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
      return "ok";
    }, 0);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a real query error", async () => {
    let calls = 0;
    await expect(
      withDbRetry(async () => {
        calls += 1;
        throw new Error('duplicate key value violates unique constraint "x"');
      }, 0),
    ).rejects.toThrow(/duplicate key/);
    expect(calls).toBe(1);
  });

  it("recognises transient faults by code or message", () => {
    expect(isTransientDbError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isTransientDbError(new Error("syntax error"))).toBe(false);
  });
});
