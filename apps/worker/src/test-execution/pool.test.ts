import { describe, expect, it } from "vitest";
import { runPool } from "./pool";

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("runPool", () => {
  it("never runs more than `workers` tasks at once", async () => {
    let active = 0;
    let peak = 0;
    await runPool([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      active -= 1;
      return { shouldStop: false };
    });
    expect(peak).toBe(2);
  });

  it("runs every item when nothing asks to stop", async () => {
    const seen: number[] = [];
    const result = await runPool([1, 2, 3], 3, async (item) => {
      seen.push(item);
      return { shouldStop: false };
    });
    expect(seen.sort()).toEqual([1, 2, 3]);
    expect(result.isStopped).toBe(false);
  });

  it("stops scheduling new tasks after fail-fast, but lets running ones finish", async () => {
    const seen: number[] = [];
    const result = await runPool([1, 2, 3, 4, 5], 1, async (item) => {
      seen.push(item);
      return { shouldStop: item === 2 };
    });
    expect(seen).toEqual([1, 2]);
    expect(result).toEqual({ isStopped: true, started: 2 });
  });
});
