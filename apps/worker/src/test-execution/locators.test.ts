import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { allMatches, resolveLocator } from "./locators";

/** A page whose elements are listed per selector, each with a visibility flag. */
function fakePage(dom: Record<string, boolean[]>): { page: Page; picked: string[] } {
  const picked: string[] = [];
  const locator = (selector: string) => {
    const visible = dom[selector] ?? [];
    return {
      selector,
      count: async () => visible.length,
      nth: (index: number) => ({
        isVisible: async () => visible[index] ?? false,
        pick: () => picked.push(`${selector}#${index}`),
        selector,
        index,
      }),
    };
  };
  return { page: { locator } as unknown as Page, picked };
}

describe("resolveLocator", () => {
  it("prefers a form's submit button over an earlier header button", async () => {
    const { page } = fakePage({
      'form button[type="submit"], form input[type="submit"]': [true],
      'form button, [role="button"]': [true, true],
    });
    const found = (await resolveLocator(page, "role:submit")) as unknown as { selector: string };
    expect(found.selector).toBe('form button[type="submit"], form input[type="submit"]');
  });

  it("honours the ordinal of a positional hint", async () => {
    const textSelector = (allMatches(fakePage({}).page, "role:text") as unknown as { selector: string }).selector;
    const { page } = fakePage({ [textSelector]: [true, true, true] });
    const found = (await resolveLocator(page, "role:text:2")) as unknown as { index: number };
    expect(found.index).toBe(2);
  });

  it("resolves a select hint to dropdowns, not text boxes", () => {
    const matched = allMatches(fakePage({}).page, "role:select") as unknown as { selector: string };
    expect(matched.selector).toContain("select");
    expect(matched.selector).not.toContain("textarea");
  });
});
